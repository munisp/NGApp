package repository

import (
	"blockchain-transparency/internal/models"
	"crypto/sha256"
	"fmt"
	"strings"
	"sync"
	"time"
)

type BlockchainRepository struct {
	mu           sync.RWMutex
	chain        []models.Block
	pendingTx    []models.Transaction
	auditLog     []models.AuditRecord
	txIndex      map[string]*models.Transaction
}

func NewBlockchainRepository() *BlockchainRepository {
	repo := &BlockchainRepository{
		txIndex: make(map[string]*models.Transaction),
	}
	repo.createGenesisBlock()
	return repo
}

func (r *BlockchainRepository) createGenesisBlock() {
	genesis := models.Block{
		Index:        0,
		Timestamp:    time.Now(),
		Hash:         "0000000000000000000000000000000000000000000000000000000000000000",
		PreviousHash: "",
		Nonce:        0,
		MerkleRoot:   "genesis",
	}
	genesis.Hash = r.calculateHash(genesis)
	r.chain = append(r.chain, genesis)
}

func (r *BlockchainRepository) calculateHash(block models.Block) string {
	data := fmt.Sprintf("%d%s%s%d%s", block.Index, block.Timestamp.String(), block.PreviousHash, block.Nonce, block.MerkleRoot)
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("%x", hash)
}

func (r *BlockchainRepository) calculateTxHash(tx models.Transaction) string {
	data := fmt.Sprintf("%s%s%s%s%f%s", tx.ID, tx.Type, tx.FromAddress, tx.ToAddress, tx.Amount, tx.CreatedAt.String())
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("%x", hash)
}

func (r *BlockchainRepository) calculateMerkleRoot(txs []models.Transaction) string {
	if len(txs) == 0 {
		return "empty"
	}
	var hashes []string
	for _, tx := range txs {
		hashes = append(hashes, r.calculateTxHash(tx))
	}
	for len(hashes) > 1 {
		var next []string
		for i := 0; i < len(hashes); i += 2 {
			if i+1 < len(hashes) {
				combined := sha256.Sum256([]byte(hashes[i] + hashes[i+1]))
				next = append(next, fmt.Sprintf("%x", combined))
			} else {
				next = append(next, hashes[i])
			}
		}
		hashes = next
	}
	return hashes[0]
}

func (r *BlockchainRepository) AddTransaction(tx *models.Transaction) {
	r.mu.Lock()
	defer r.mu.Unlock()
	tx.Signature = r.calculateTxHash(*tx)
	tx.Status = "pending"
	r.pendingTx = append(r.pendingTx, *tx)
	r.txIndex[tx.ID] = tx
}

func (r *BlockchainRepository) MineBlock() *models.Block {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.pendingTx) == 0 {
		return nil
	}
	lastBlock := r.chain[len(r.chain)-1]
	merkle := r.calculateMerkleRoot(r.pendingTx)

	block := models.Block{
		Index:        lastBlock.Index + 1,
		Timestamp:    time.Now(),
		PreviousHash: lastBlock.Hash,
		Transactions: r.pendingTx,
		MerkleRoot:   merkle,
	}

	for nonce := int64(0); ; nonce++ {
		block.Nonce = nonce
		hash := r.calculateHash(block)
		if strings.HasPrefix(hash, "00") {
			block.Hash = hash
			break
		}
		if nonce > 100000 {
			block.Hash = r.calculateHash(block)
			break
		}
	}

	now := time.Now()
	for i := range block.Transactions {
		block.Transactions[i].Status = "confirmed"
		block.Transactions[i].BlockHash = block.Hash
		block.Transactions[i].BlockIndex = block.Index
		block.Transactions[i].ConfirmedAt = &now
		if tx, ok := r.txIndex[block.Transactions[i].ID]; ok {
			tx.Status = "confirmed"
			tx.BlockHash = block.Hash
			tx.BlockIndex = block.Index
			tx.ConfirmedAt = &now
		}
	}

	r.chain = append(r.chain, block)
	r.pendingTx = nil
	return &block
}

func (r *BlockchainRepository) GetBlock(index int64) (*models.Block, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if index < 0 || int(index) >= len(r.chain) {
		return nil, fmt.Errorf("block %d not found", index)
	}
	return &r.chain[index], nil
}

func (r *BlockchainRepository) GetTransaction(id string) (*models.Transaction, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	tx, ok := r.txIndex[id]
	if !ok {
		return nil, fmt.Errorf("transaction %s not found", id)
	}
	return tx, nil
}

func (r *BlockchainRepository) GetChain() []models.Block {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.chain
}

func (r *BlockchainRepository) ValidateChain() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for i := 1; i < len(r.chain); i++ {
		if r.chain[i].PreviousHash != r.chain[i-1].Hash {
			return false
		}
	}
	return true
}

func (r *BlockchainRepository) AddAuditRecord(record *models.AuditRecord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	data := fmt.Sprintf("%s%s%s%s", record.TransactionID, record.Action, record.Actor, record.Timestamp.String())
	hash := sha256.Sum256([]byte(data))
	record.Hash = fmt.Sprintf("%x", hash)
	r.auditLog = append(r.auditLog, *record)
}

func (r *BlockchainRepository) GetAuditLog(txID string) []models.AuditRecord {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var records []models.AuditRecord
	for _, rec := range r.auditLog {
		if txID == "" || rec.TransactionID == txID {
			records = append(records, rec)
		}
	}
	return records
}

func (r *BlockchainRepository) GetStats() models.ChainStats {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var totalTx int64
	var totalValue float64
	for _, b := range r.chain {
		totalTx += int64(len(b.Transactions))
		for _, tx := range b.Transactions {
			totalValue += tx.Amount
		}
	}
	lastBlock := r.chain[len(r.chain)-1]
	return models.ChainStats{
		TotalBlocks:       int64(len(r.chain)),
		TotalTransactions: totalTx,
		TotalValue:        totalValue,
		PendingTx:         len(r.pendingTx),
		ChainValid:        r.ValidateChain(),
		LastBlockHash:     lastBlock.Hash,
		LastBlockTime:     lastBlock.Timestamp.Format(time.RFC3339),
	}
}
