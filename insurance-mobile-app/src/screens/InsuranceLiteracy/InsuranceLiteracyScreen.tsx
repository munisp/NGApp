import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Course {
  id: string;
  title: string;
  description: string;
  duration: string;
  lessons: number;
  points: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  completed: boolean;
  progress?: number;
  icon: string;
}

interface Quiz {
  id: string;
  title: string;
  questions: number;
  passingScore: number;
  bestScore?: number;
  completed: boolean;
  points: number;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const userProgress = {
  coursesCompleted: 5,
  totalCourses: 12,
  quizzesPassed: 8,
  certificatesEarned: 2,
  pointsEarned: 1250,
  currentStreak: 7,
};

const courses: Course[] = [
  {
    id: '1',
    title: 'Insurance Basics 101',
    description: 'Learn the fundamentals of insurance',
    duration: '30 mins',
    lessons: 5,
    points: 200,
    level: 'Beginner',
    completed: true,
    icon: 'book-open-variant',
  },
  {
    id: '2',
    title: 'Understanding Health Insurance',
    description: 'Navigate health insurance plans',
    duration: '45 mins',
    lessons: 7,
    points: 250,
    level: 'Beginner',
    completed: true,
    icon: 'heart-pulse',
  },
  {
    id: '3',
    title: 'Auto Insurance Explained',
    description: 'Everything about car insurance',
    duration: '40 mins',
    lessons: 6,
    points: 200,
    level: 'Beginner',
    completed: false,
    progress: 60,
    icon: 'car',
  },
  {
    id: '4',
    title: 'Home & Property Insurance',
    description: 'Protect your home and belongings',
    duration: '50 mins',
    lessons: 8,
    points: 300,
    level: 'Intermediate',
    completed: false,
    icon: 'home',
  },
  {
    id: '5',
    title: 'Agricultural Insurance Guide',
    description: 'Crop, livestock, and farm insurance',
    duration: '45 mins',
    lessons: 7,
    points: 300,
    level: 'Intermediate',
    completed: false,
    icon: 'sprout',
  },
];

const quizzes: Quiz[] = [
  { id: '1', title: 'Insurance Basics Quiz', questions: 10, passingScore: 70, bestScore: 90, completed: true, points: 100 },
  { id: '2', title: 'Health Insurance Quiz', questions: 15, passingScore: 70, bestScore: 85, completed: true, points: 150 },
  { id: '3', title: 'Auto Insurance Quiz', questions: 12, passingScore: 70, completed: false, points: 120 },
];

const faqs: FAQ[] = [
  {
    id: '1',
    question: 'What is insurance and why do I need it?',
    answer: 'Insurance is a contract that protects you financially against unexpected events. It provides peace of mind and financial security for you and your family.',
    category: 'Basics',
  },
  {
    id: '2',
    question: 'How do I file a claim?',
    answer: 'You can file a claim through our app, website, or by calling our customer service. Have your policy number and incident details ready.',
    category: 'Claims',
  },
  {
    id: '3',
    question: 'What factors affect my premium?',
    answer: 'Premiums are based on risk factors like age, location, coverage amount, claims history, and the type of insurance you need.',
    category: 'Pricing',
  },
  {
    id: '4',
    question: 'Can I cancel my policy anytime?',
    answer: 'Yes, you can cancel your policy at any time. However, there may be cancellation fees depending on your policy terms.',
    category: 'Policy',
  },
];

export default function InsuranceLiteracyScreen() {
  const [activeTab, setActiveTab] = useState<'courses' | 'quizzes' | 'faqs'>('courses');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Beginner':
        return '#22c55e';
      case 'Intermediate':
        return '#f59e0b';
      case 'Advanced':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Insurance Literacy Hub</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.progressCard}>
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Icon name="book-check" size={24} color="#3b82f6" />
              <Text style={styles.progressValue}>{userProgress.coursesCompleted}/{userProgress.totalCourses}</Text>
              <Text style={styles.progressLabel}>Courses</Text>
            </View>
            <View style={styles.progressStat}>
              <Icon name="check-decagram" size={24} color="#22c55e" />
              <Text style={styles.progressValue}>{userProgress.quizzesPassed}</Text>
              <Text style={styles.progressLabel}>Quizzes</Text>
            </View>
            <View style={styles.progressStat}>
              <Icon name="certificate" size={24} color="#f59e0b" />
              <Text style={styles.progressValue}>{userProgress.certificatesEarned}</Text>
              <Text style={styles.progressLabel}>Certificates</Text>
            </View>
            <View style={styles.progressStat}>
              <Icon name="star" size={24} color="#8b5cf6" />
              <Text style={styles.progressValue}>{userProgress.pointsEarned}</Text>
              <Text style={styles.progressLabel}>Points</Text>
            </View>
          </View>
          <View style={styles.streakBadge}>
            <Icon name="fire" size={20} color="#ef4444" />
            <Text style={styles.streakText}>{userProgress.currentStreak} Day Streak!</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search courses..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.tabContainer}>
          {['courses', 'quizzes', 'faqs'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'courses' && (
          <View style={styles.section}>
            {courses
              .filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((course) => (
                <TouchableOpacity key={course.id} style={styles.courseCard}>
                  <View style={styles.courseHeader}>
                    <View style={[styles.courseIcon, { backgroundColor: getLevelColor(course.level) + '20' }]}>
                      <Icon name={course.icon} size={24} color={getLevelColor(course.level)} />
                    </View>
                    <View style={styles.courseInfo}>
                      <View style={styles.courseTitleRow}>
                        <Text style={styles.courseTitle}>{course.title}</Text>
                        {course.completed && (
                          <Icon name="check-circle" size={18} color="#22c55e" />
                        )}
                      </View>
                      <Text style={styles.courseDescription}>{course.description}</Text>
                    </View>
                  </View>
                  <View style={styles.courseMeta}>
                    <View style={[styles.levelBadge, { backgroundColor: getLevelColor(course.level) + '20' }]}>
                      <Text style={[styles.levelText, { color: getLevelColor(course.level) }]}>
                        {course.level}
                      </Text>
                    </View>
                    <View style={styles.courseStats}>
                      <Icon name="clock-outline" size={14} color="#6b7280" />
                      <Text style={styles.courseStatText}>{course.duration}</Text>
                      <Icon name="book-outline" size={14} color="#6b7280" style={{ marginLeft: 8 }} />
                      <Text style={styles.courseStatText}>{course.lessons} lessons</Text>
                      <Icon name="star-outline" size={14} color="#6b7280" style={{ marginLeft: 8 }} />
                      <Text style={styles.courseStatText}>{course.points} pts</Text>
                    </View>
                  </View>
                  {course.progress !== undefined && !course.completed && (
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBarFill, { width: `${course.progress}%` }]} />
                      <Text style={styles.progressBarText}>{course.progress}%</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.courseButton}>
                    <Text style={styles.courseButtonText}>
                      {course.completed ? 'Review' : course.progress ? 'Continue' : 'Start'}
                    </Text>
                    <Icon name="arrow-right" size={16} color="#3b82f6" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
          </View>
        )}

        {activeTab === 'quizzes' && (
          <View style={styles.section}>
            {quizzes.map((quiz) => (
              <TouchableOpacity key={quiz.id} style={styles.quizCard}>
                <View style={styles.quizHeader}>
                  <View style={styles.quizIcon}>
                    <Icon name="help-circle" size={24} color="#3b82f6" />
                  </View>
                  <View style={styles.quizInfo}>
                    <Text style={styles.quizTitle}>{quiz.title}</Text>
                    <Text style={styles.quizMeta}>
                      {quiz.questions} questions | Pass: {quiz.passingScore}%
                    </Text>
                  </View>
                  {quiz.completed && (
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreText}>{quiz.bestScore}%</Text>
                    </View>
                  )}
                </View>
                <View style={styles.quizFooter}>
                  <View style={styles.quizPoints}>
                    <Icon name="star" size={14} color="#f59e0b" />
                    <Text style={styles.quizPointsText}>{quiz.points} pts</Text>
                  </View>
                  <TouchableOpacity style={styles.quizButton}>
                    <Text style={styles.quizButtonText}>
                      {quiz.completed ? 'Retake' : 'Start Quiz'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'faqs' && (
          <View style={styles.section}>
            {faqs.map((faq) => (
              <TouchableOpacity
                key={faq.id}
                style={styles.faqCard}
                onPress={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
              >
                <View style={styles.faqHeader}>
                  <View style={styles.faqQuestion}>
                    <Icon name="help-circle-outline" size={20} color="#3b82f6" />
                    <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  </View>
                  <Icon
                    name={expandedFaq === faq.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#6b7280"
                  />
                </View>
                {expandedFaq === faq.id && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    <View style={styles.faqCategory}>
                      <Text style={styles.faqCategoryText}>{faq.category}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  content: {
    flex: 1,
  },
  progressCard: {
    margin: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  streakText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#1f2937',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginVertical: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  courseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  courseHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  courseIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  courseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  courseDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  courseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  courseStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courseStatText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    marginBottom: 12,
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  progressBarText: {
    position: 'absolute',
    right: 0,
    top: -16,
    fontSize: 11,
    color: '#6b7280',
  },
  courseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 10,
    borderRadius: 8,
  },
  courseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
    marginRight: 4,
  },
  quizCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  quizIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quizInfo: {
    flex: 1,
    marginLeft: 12,
  },
  quizTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  quizMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  scoreBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
  },
  quizFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quizPoints: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quizPointsText: {
    marginLeft: 4,
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '500',
  },
  quizButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  quizButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  faqCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginLeft: 10,
    flex: 1,
  },
  faqAnswer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  faqCategory: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  faqCategoryText: {
    fontSize: 11,
    color: '#6b7280',
  },
});
