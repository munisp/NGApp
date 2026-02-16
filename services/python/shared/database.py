import os
import time
import random
import logging
import threading
from typing import Optional
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class DBConfig:
    def __init__(self):
        self.primary_host = os.getenv("PGBOUNCER_HOST", "pgbouncer")
        self.primary_port = int(os.getenv("PGBOUNCER_PORT", "6432"))
        self.replica_host = os.getenv("PGBOUNCER_REPLICA_HOST", "")
        self.replica_port = int(os.getenv("PGBOUNCER_REPLICA_PORT", "6432"))
        self.db_name = os.getenv("POSTGRES_DB", "fintech")
        self.user = os.getenv("POSTGRES_USER", "fintech")
        self.password = os.getenv("POSTGRES_PASSWORD", "fintech_secret")
        self.readonly_user = os.getenv("POSTGRES_READONLY_USER", self.user)
        self.readonly_password = os.getenv("POSTGRES_READONLY_PASSWORD", self.password)
        self.max_connections = int(os.getenv("DB_MAX_CONNECTIONS", "20"))
        self.min_connections = int(os.getenv("DB_MIN_CONNECTIONS", "5"))
        self.statement_timeout_ms = int(os.getenv("STATEMENT_TIMEOUT_MS", "30000"))
        self.connect_timeout = int(os.getenv("DB_CONNECT_TIMEOUT", "10"))

    @property
    def primary_dsn(self) -> str:
        return (
            f"host={self.primary_host} port={self.primary_port} "
            f"dbname={self.db_name} user={self.user} password={self.password} "
            f"options='-c statement_timeout={self.statement_timeout_ms}' "
            f"connect_timeout={self.connect_timeout}"
        )

    @property
    def replica_dsn(self) -> str:
        if not self.replica_host:
            return self.primary_dsn
        return (
            f"host={self.replica_host} port={self.replica_port} "
            f"dbname={self.db_name} user={self.readonly_user} "
            f"password={self.readonly_password} "
            f"options='-c statement_timeout={self.statement_timeout_ms}' "
            f"connect_timeout={self.connect_timeout}"
        )


class ConnectionPool:
    def __init__(self, config: Optional[DBConfig] = None):
        self.config = config or DBConfig()
        self._primary_pool = None
        self._replica_pools: list = []
        self._replica_idx = 0
        self._lock = threading.Lock()
        self._health = {"primary": True}
        self._initialized = False

    def initialize(self):
        if self._initialized:
            return
        try:
            import psycopg2
            from psycopg2 import pool as pg_pool

            self._primary_pool = pg_pool.ThreadedConnectionPool(
                minconn=self.config.min_connections,
                maxconn=self.config.max_connections,
                dsn=self.config.primary_dsn,
            )
            logger.info("Primary connection pool initialized via PgBouncer")

            if self.config.replica_host:
                replica_pool = pg_pool.ThreadedConnectionPool(
                    minconn=self.config.min_connections,
                    maxconn=self.config.max_connections * 2,
                    dsn=self.config.replica_dsn,
                )
                self._replica_pools.append(replica_pool)
                logger.info("Replica connection pool initialized via PgBouncer")

            self._initialized = True
            self._start_health_checker()
        except ImportError:
            logger.warning("psycopg2 not available, DB pool not initialized")
        except Exception as e:
            logger.warning(f"DB pool init deferred: {e}")

    @contextmanager
    def get_primary(self):
        if not self._initialized:
            self.initialize()
        if self._primary_pool is None:
            yield None
            return
        conn = self._primary_pool.getconn()
        try:
            yield conn
        finally:
            self._primary_pool.putconn(conn)

    @contextmanager
    def get_replica(self):
        if not self._initialized:
            self.initialize()
        if not self._replica_pools:
            with self.get_primary() as conn:
                yield conn
                return
        with self._lock:
            self._replica_idx = (self._replica_idx + 1) % len(self._replica_pools)
            pool = self._replica_pools[self._replica_idx]
        conn = pool.getconn()
        try:
            yield conn
        finally:
            pool.putconn(conn)

    @contextmanager
    def read_connection(self):
        healthy_replicas = [
            p for i, p in enumerate(self._replica_pools)
            if self._health.get(f"replica-{i}", True)
        ]
        if healthy_replicas:
            pool = random.choice(healthy_replicas)
            conn = pool.getconn()
            try:
                yield conn
            finally:
                pool.putconn(conn)
        else:
            with self.get_primary() as conn:
                yield conn

    @contextmanager
    def write_connection(self):
        with self.get_primary() as conn:
            yield conn

    def _start_health_checker(self):
        def check():
            while True:
                try:
                    if self._primary_pool:
                        conn = self._primary_pool.getconn()
                        try:
                            cur = conn.cursor()
                            cur.execute("SELECT 1")
                            cur.close()
                            self._health["primary"] = True
                        except Exception:
                            self._health["primary"] = False
                        finally:
                            self._primary_pool.putconn(conn)

                    for i, pool in enumerate(self._replica_pools):
                        try:
                            conn = pool.getconn()
                            cur = conn.cursor()
                            cur.execute("SELECT 1")
                            cur.close()
                            pool.putconn(conn)
                            self._health[f"replica-{i}"] = True
                        except Exception:
                            self._health[f"replica-{i}"] = False
                except Exception:
                    pass
                time.sleep(10)

        t = threading.Thread(target=check, daemon=True)
        t.start()

    def stats(self) -> dict:
        result = {"initialized": self._initialized, "health": dict(self._health)}
        if self._primary_pool:
            result["primary_pool"] = {
                "min": self.config.min_connections,
                "max": self.config.max_connections,
            }
        result["replica_count"] = len(self._replica_pools)
        return result

    def close(self):
        if self._primary_pool:
            self._primary_pool.closeall()
        for pool in self._replica_pools:
            pool.closeall()


db_pool = ConnectionPool()
