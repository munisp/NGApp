package service

import (
	"multi-language-service/internal/models"
	"multi-language-service/internal/repository"
	"strings"
)

type I18nService struct {
	repo *repository.I18nRepository
}

func NewI18nService(repo *repository.I18nRepository) *I18nService {
	return &I18nService{repo: repo}
}

func (s *I18nService) GetLanguages() []models.Language { return s.repo.GetLanguages() }

func (s *I18nService) GetBundle(lang string) *models.TranslationBundle {
	return s.repo.GetBundle(lang)
}

func (s *I18nService) Translate(key, lang string, vars map[string]string) string {
	text := s.repo.Translate(key, lang)
	for k, v := range vars {
		text = strings.ReplaceAll(text, "{{"+k+"}}", v)
	}
	return text
}

func (s *I18nService) SetTranslation(t models.Translation) {
	s.repo.SetTranslation(t)
}

func (s *I18nService) GetStats() map[string]interface{} { return s.repo.GetStats() }
