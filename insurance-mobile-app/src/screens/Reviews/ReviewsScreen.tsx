import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Card, Title, Text, Button, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '../../services/api';
import { spacing, typography, theme } from '../../utils/theme';
import { format } from 'date-fns';

interface Review {
  id: number;
  rating: number;
  title: string;
  comment: string;
  date: string;
  response?: string;
}

export default function ReviewsScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => reviewsApi.getAll(),
  });

  const submitReviewMutation = useMutation({
    mutationFn: (data: any) => reviewsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setRating(0);
      setTitle('');
      setComment('');
      setShowForm(false);
      Alert.alert('Thank You!', 'Your review has been submitted successfully.');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    },
  });

  const reviews: Review[] = reviewsData?.data || [];

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your review');
      return;
    }
    if (!comment.trim() || comment.length < 10) {
      Alert.alert('Comment Required', 'Please enter at least 10 characters');
      return;
    }

    submitReviewMutation.mutate({ rating, title, comment });
  };

  const renderStars = (count: number, interactive: boolean = false, size: number = 24) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => interactive && setRating(star)}
            disabled={!interactive}
          >
            <Icon
              name={star <= (interactive ? rating : count) ? 'star' : 'star-outline'}
              size={size}
              color={star <= (interactive ? rating : count) ? '#f59e0b' : theme.colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Title style={styles.headerTitle}>Reviews</Title>
        <View style={{ width: 24 }} />
      </View>

      <Card style={styles.heroCard}>
        <Card.Content style={styles.heroContent}>
          <Icon name="star-circle" size={48} color="#f59e0b" />
          <Title style={styles.heroTitle}>Share Your Experience</Title>
          <Text style={styles.heroSubtitle}>
            Your feedback helps us improve and helps others make informed decisions
          </Text>
          {!showForm && (
            <Button
              mode="contained"
              onPress={() => setShowForm(true)}
              style={styles.writeButton}
              icon="pencil"
            >
              Write a Review
            </Button>
          )}
        </Card.Content>
      </Card>

      {showForm && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Write Your Review</Title>
            
            <Text style={styles.inputLabel}>Your Rating</Text>
            {renderStars(rating, true, 36)}
            
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Summarize your experience"
              style={styles.input}
              mode="outlined"
            />
            
            <Text style={styles.inputLabel}>Your Review</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Tell us about your experience with InsurePortal..."
              multiline
              numberOfLines={4}
              style={[styles.input, styles.textArea]}
              mode="outlined"
            />
            
            <View style={styles.formActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  setShowForm(false);
                  setRating(0);
                  setTitle('');
                  setComment('');
                }}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={submitReviewMutation.isPending}
                disabled={submitReviewMutation.isPending}
                style={styles.submitButton}
              >
                Submit Review
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Your Reviews</Title>
          
          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="comment-text-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No reviews yet</Text>
              <Text style={styles.emptySubtext}>
                Share your experience to help others
              </Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  {renderStars(review.rating, false, 16)}
                  <Text style={styles.reviewDate}>
                    {format(new Date(review.date), 'MMM dd, yyyy')}
                  </Text>
                </View>
                <Text style={styles.reviewTitle}>{review.title}</Text>
                <Text style={styles.reviewComment}>{review.comment}</Text>
                
                {review.response && (
                  <View style={styles.responseContainer}>
                    <View style={styles.responseHeader}>
                      <Icon name="reply" size={16} color={theme.colors.primary} />
                      <Text style={styles.responseLabel}>Response from InsurePortal</Text>
                    </View>
                    <Text style={styles.responseText}>{review.response}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Review Guidelines</Title>
          
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={20} color={theme.colors.success} />
            <Text style={styles.guidelineText}>
              Be honest and specific about your experience
            </Text>
          </View>
          
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={20} color={theme.colors.success} />
            <Text style={styles.guidelineText}>
              Focus on the service quality and customer support
            </Text>
          </View>
          
          <View style={styles.guidelineItem}>
            <Icon name="check-circle" size={20} color={theme.colors.success} />
            <Text style={styles.guidelineText}>
              Mention specific features you liked or disliked
            </Text>
          </View>
          
          <View style={styles.guidelineItem}>
            <Icon name="close-circle" size={20} color={theme.colors.error} />
            <Text style={styles.guidelineText}>
              Avoid personal information or offensive language
            </Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
  },
  heroCard: {
    margin: spacing.md,
    backgroundColor: '#fef3c7',
  },
  heroContent: {
    alignItems: 'center',
    padding: spacing.md,
  },
  heroTitle: {
    ...typography.h2,
    color: '#92400e',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.body,
    color: '#b45309',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  writeButton: {
    marginTop: spacing.lg,
  },
  card: {
    margin: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.surface,
  },
  textArea: {
    minHeight: 100,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: theme.colors.text,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.caption,
    color: theme.colors.textSecondary,
    marginTop: spacing.xs,
  },
  reviewItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  reviewDate: {
    ...typography.small,
    color: theme.colors.textSecondary,
  },
  reviewTitle: {
    ...typography.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: spacing.xs,
  },
  reviewComment: {
    ...typography.body,
    color: theme.colors.text,
    lineHeight: 22,
  },
  responseContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.roundness,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  responseLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: theme.colors.primary,
    marginLeft: spacing.sm,
  },
  responseText: {
    ...typography.body,
    color: theme.colors.text,
    fontStyle: 'italic',
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  guidelineText: {
    ...typography.body,
    color: theme.colors.text,
    flex: 1,
    marginLeft: spacing.md,
  },
});
