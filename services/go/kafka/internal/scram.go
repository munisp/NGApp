package internal

import (
	"crypto/sha256"
	"crypto/sha512"
	"hash"

	"github.com/IBM/sarama"
)

var (
	SHA256 scramHashGen = sha256.New
	SHA512 scramHashGen = sha512.New
)

type scramHashGen func() hash.Hash

type XDGSCRAMClient struct {
	HashGeneratorFcn scramHashGen
	conversation     []byte
}

func (x *XDGSCRAMClient) Begin(userName, password, authzID string) (err error) {
	return nil
}

func (x *XDGSCRAMClient) Step(challenge string) (response string, err error) {
	return "", nil
}

func (x *XDGSCRAMClient) Done() bool {
	return true
}

var _ sarama.SCRAMClient = (*XDGSCRAMClient)(nil)
