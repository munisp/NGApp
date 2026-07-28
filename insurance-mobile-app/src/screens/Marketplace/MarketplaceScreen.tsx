import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { Text, Card, Chip, Searchbar, Badge } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';

interface InsuranceProduct {
  id: number;
  name: string;
  provider: string;
  providerLogo: string;
  type: string;
  premium: number;
  premiumFrequency: 'monthly' | 'yearly';
  coverage: number;
  rating: number;
  reviewCount: number;
  features: string[];
  popular: boolean;
  recommended: boolean;
}

const CATEGORIES = [
  { id: 'all', name: 'All', icon: 'view-grid' },
  { id: 'health', name: 'Health', icon: 'heart-pulse' },
  { id: 'auto', name: 'Auto', icon: 'car' },
  { id: 'property', name: 'Property', icon: 'home' },
  { id: 'life', name: 'Life', icon: 'account-heart' },
  { id: 'travel', name: 'Travel', icon: 'airplane' },
  { id: 'crop', name: 'Crop', icon: 'sprout' },
  { id: 'livestock', name: 'Livestock', icon: 'cow' },
];

const MOCK_PRODUCTS: InsuranceProduct[] = [
  {
    id: 1,
    name: 'Premium Health Cover',
    provider: 'AXA Mansard',
    providerLogo: 'https://via.placeholder.com/50',
    type: 'health',
    premium: 150000,
    premiumFrequency: 'yearly',
    coverage: 5000000,
    rating: 4.8,
    reviewCount: 1250,
    features: ['Hospital Cover', 'Outpatient', 'Dental', 'Optical'],
    popular: true,
    recommended: true,
  },
  {
    id: 2,
    name: 'Comprehensive Auto',
    provider: 'Leadway Assurance',
    providerLogo: 'https://via.placeholder.com/50',
    type: 'auto',
    premium: 85000,
    premiumFrequency: 'yearly',
    coverage: 10000000,
    rating: 4.6,
    reviewCount: 890,
    features: ['Third Party', 'Theft', 'Accident', 'Flood'],
    popular: true,
    recommended: false,
  },
  {
    id: 3,
    name: 'Family Life Plan',
    provider: 'Custodian Life',
    providerLogo: 'https://via.placeholder.com/50',
    type: 'life',
    premium: 50000,
    premiumFrequency: 'yearly',
    coverage: 20000000,
    rating: 4.7,
    reviewCount: 650,
    features: ['Death Benefit', 'Critical Illness', 'Disability', 'Education'],
    popular: false,
    recommended: true,
  },
  {
    id: 4,
    name: 'Crop Protection Plus',
    provider: 'AIICO Insurance',
    providerLogo: 'https://via.placeholder.com/50',
    type: 'crop',
    premium: 25000,
    premiumFrequency: 'yearly',
    coverage: 2000000,
    rating: 4.5,
    reviewCount: 320,
    features: ['Weather Index', 'Pest Damage', 'Disease', 'Yield Guarantee'],
    popular: false,
    recommended: false,
  },
];

export default function MarketplaceScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'price' | 'rating' | 'popular'>('popular');

  const { data: products = MOCK_PRODUCTS } = useQuery({
    queryKey: ['marketplace-products', selectedCategory],
    queryFn: async () => {
      const response = await apiClient.get('/marketplace/products', {
        params: { category: selectedCategory },
      });
      return response.data;
    },
    placeholderData: MOCK_PRODUCTS,
  });

  const filteredProducts = products
    .filter((p: InsuranceProduct) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.provider.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.type === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a: InsuranceProduct, b: InsuranceProduct) => {
      if (sortBy === 'price') return a.premium - b.premium;
      if (sortBy === 'rating') return b.rating - a.rating;
      return b.popular ? 1 : -1;
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderCategory = ({ item }: { item: typeof CATEGORIES[0] }) => (
    <TouchableOpacity
      style={[styles.categoryItem, selectedCategory === item.id && styles.categoryItemActive]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <Icon
        name={item.icon}
        size={24}
        color={selectedCategory === item.id ? '#fff' : theme.colors.primary}
      />
      <Text style={[styles.categoryText, selectedCategory === item.id && styles.categoryTextActive]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderProduct = ({ item }: { item: InsuranceProduct }) => (
    <TouchableOpacity onPress={() => navigation.navigate('ProductDetail', { id: item.id })}>
      <Card style={styles.productCard}>
        <Card.Content>
          <View style={styles.productHeader}>
            <View style={styles.providerInfo}>
              <View style={styles.providerLogo}>
                <Icon name="shield-check" size={24} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.providerName}>{item.provider}</Text>
              </View>
            </View>
            <View style={styles.badges}>
              {item.recommended && (
                <Badge style={styles.recommendedBadge}>Recommended</Badge>
              )}
              {item.popular && (
                <Badge style={styles.popularBadge}>Popular</Badge>
              )}
            </View>
          </View>

          <View style={styles.ratingContainer}>
            <Icon name="star" size={16} color="#f59e0b" />
            <Text style={styles.rating}>{item.rating}</Text>
            <Text style={styles.reviewCount}>({item.reviewCount} reviews)</Text>
          </View>

          <View style={styles.featuresContainer}>
            {item.features.slice(0, 4).map((feature, index) => (
              <Chip key={index} style={styles.featureChip} textStyle={styles.featureText}>
                {feature}
              </Chip>
            ))}
          </View>

          <View style={styles.priceContainer}>
            <View>
              <Text style={styles.priceLabel}>Premium</Text>
              <Text style={styles.price}>
                {formatCurrency(item.premium)}
                <Text style={styles.frequency}>/{item.premiumFrequency}</Text>
              </Text>
            </View>
            <View>
              <Text style={styles.priceLabel}>Coverage</Text>
              <Text style={styles.coverage}>{formatCurrency(item.coverage)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.getQuoteButton}
            onPress={() => navigation.navigate('InsuranceApplication', { productId: item.id })}
          >
            <Text style={styles.getQuoteText}>Get Quote</Text>
            <Icon name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Insurance Marketplace</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Icon name="filter-variant" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <Searchbar
        placeholder="Search insurance products..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <FlatList
        horizontal
        data={CATEGORIES}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      />

      <View style={styles.sortContainer}>
        <Text style={styles.resultsCount}>{filteredProducts.length} products found</Text>
        <View style={styles.sortButtons}>
          {(['popular', 'rating', 'price'] as const).map((sort) => (
            <TouchableOpacity
              key={sort}
              style={[styles.sortButton, sortBy === sort && styles.sortButtonActive]}
              onPress={() => setSortBy(sort)}
            >
              <Text style={[styles.sortText, sortBy === sort && styles.sortTextActive]}>
                {sort.charAt(0).toUpperCase() + sort.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.productsContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: theme.colors.text,
  },
  filterButton: {
    padding: spacing.xs,
  },
  searchbar: {
    margin: spacing.md,
    marginTop: 0,
    elevation: 0,
    backgroundColor: theme.colors.surface,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  categoryItem: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  categoryItemActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryText: {
    ...typography.small,
    color: theme.colors.primary,
    marginTop: spacing.xs,
  },
  categoryTextActive: {
    color: '#fff',
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  resultsCount: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  sortButtons: {
    flexDirection: 'row',
  },
  sortButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginLeft: spacing.xs,
    borderRadius: theme.roundness,
  },
  sortButtonActive: {
    backgroundColor: theme.colors.primary + '20',
  },
  sortText: {
    ...typography.small,
    color: theme.colors.textSecondary,
  },
  sortTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  productsContainer: {
    padding: spacing.md,
    paddingTop: 0,
  },
  productCard: {
    marginBottom: spacing.md,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  productName: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  providerName: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  badges: {
    flexDirection: 'row',
  },
  recommendedBadge: {
    backgroundColor: theme.colors.success,
    marginRight: spacing.xs,
  },
  popularBadge: {
    backgroundColor: theme.colors.warning,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rating: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: spacing.xs,
  },
  reviewCount: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginLeft: spacing.xs,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  featureChip: {
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    backgroundColor: theme.colors.background,
  },
  featureText: {
    ...typography.small,
    color: theme.colors.text,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness,
  },
  priceLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  price: {
    ...typography.h3,
    color: theme.colors.primary,
  },
  frequency: {
    ...typography.caption,
    color: theme.colors.textSecondary,
  },
  coverage: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  getQuoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: spacing.md,
    borderRadius: theme.roundness,
  },
  getQuoteText: {
    ...typography.body,
    fontWeight: '600',
    color: '#fff',
    marginRight: spacing.sm,
  },
});
