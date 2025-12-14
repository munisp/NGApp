# Apache DataFusion Ray Research Findings

## ⚠️ CRITICAL NOTE
**DataFusion for Ray is NO LONGER MAINTAINED** according to the official GitHub repository.

## Overview
DataFusion for Ray was a distributed execution framework that enabled DataFusion DataFrame and SQL queries to run on a Ray cluster. It provided integration between Apache DataFusion (a fast query engine in Rust) and Ray's dynamic scheduling capabilities.

## Architecture

### Execution Modes
1. **Streaming Execution** (Implemented)
   - Mimics default DataFusion execution strategy
   - Pipelined execution model
   - Operators start executing as soon as inputs are available

2. **Batch Execution** (NOT Implemented)
   - Staged model similar to Apache Spark
   - Each stage runs to completion
   - Produces intermediate shuffle files
   - Tracking issue: #69

## Technical Stack
- **Languages**: Python (50.1%), Rust (44.0%), Shell (5.9%)
- **License**: Apache 2.0
- **Dependencies**: Ray, DataFusion, Arrow

## API Example
```python
import ray
from datafusion_ray import DFRayContext, df_ray_runtime_env

ray.init(runtime_env=df_ray_runtime_env)

ctx = DFRayContext()
ctx.register_csv(
    "aggregate_test_100",
    "https://github.com/apache/arrow-testing/raw/master/data/csv/aggregate_test_100.csv",
)

df = ctx.sql("SELECT c1,c2,c3 FROM aggregate_test_100 LIMIT 5")
df.show()
```

## Alternative Approach
Since DataFusion Ray is no longer maintained, we should use:
1. **Ray Data** - Ray's native data processing library
2. **Apache Spark with Ray** - Ray on Spark integration
3. **Direct DataFusion + Ray integration** - Custom implementation
4. **PySpark with Delta Lake** - More mature ecosystem

## Recommendation for Lakehouse Architecture
Given the unmaintained status of DataFusion Ray, the implementation should focus on:
- **Apache Spark** as the primary compute engine (mature, widely adopted)
- **Ray** for distributed ML workloads and parallel processing
- **Delta Lake** for ACID transactions and time travel on Parquet
- **DataFusion** (optional) for fast query execution in specific use cases
- Integration between these components rather than relying on DataFusion Ray
