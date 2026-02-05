import { ScrollView, Text, View, Pressable, Modal, Alert } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  getCourses,
  getAllProgress,
  getCertificates,
  getLearningStatistics,
  getCourseProgress,
  startCourse,
  completeLesson,
  submitQuiz,
  getCourseCompletionPercentage,
  type Course,
  type UserProgress,
  type Certificate,
  type Lesson,
  type QuizQuestion,
} from "@/utils/financial-literacy";

export default function FinancialLiteracyScreen() {
  const colors = useColors();
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [showCertificate, setShowCertificate] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [coursesData, progressData, certificatesData, statsData] = await Promise.all([
      getCourses(),
      getAllProgress(),
      getCertificates(),
      getLearningStatistics(),
    ]);
    
    setCourses(coursesData);
    setProgress(progressData);
    setCertificates(certificatesData);
    setStats(statsData);
  };

  const handleStartCourse = async (course: Course) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startCourse(course.id);
      setSelectedCourse(course);
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to start course");
    }
  };

  const handleCompleteLesson = async (courseId: string, lessonId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await completeLesson(courseId, lessonId);
      setSelectedLesson(null);
      await loadData();
      
      // Check if all lessons completed
      const courseProgress = await getCourseProgress(courseId);
      const course = courses.find((c) => c.id === courseId);
      
      if (course && courseProgress && courseProgress.completed_lessons.length === course.lessons.length) {
        Alert.alert(
          "All Lessons Complete!",
          "You've finished all lessons. Ready to take the quiz?",
          [
            { text: "Later", style: "cancel" },
            { text: "Take Quiz", onPress: () => setShowQuiz(true) },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to complete lesson");
    }
  };

  const handleSubmitQuiz = async () => {
    if (!selectedCourse) return;

    if (quizAnswers.length !== selectedCourse.quiz.length) {
      Alert.alert("Incomplete", "Please answer all questions");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const result = await submitQuiz(selectedCourse.id, quizAnswers);
      
      if (result.passed) {
        Alert.alert(
          "Congratulations!",
          `You passed with ${result.score}%! You've earned a certificate.`,
          [
            {
              text: "View Certificate",
              onPress: () => {
                setShowQuiz(false);
                setQuizAnswers([]);
                if (result.certificate) {
                  setSelectedCertificate(result.certificate);
                  setShowCertificate(true);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Not Quite",
          `You scored ${result.score}%. You need 70% to pass. Review the lessons and try again!`,
          [{ text: "OK", onPress: () => { setShowQuiz(false); setQuizAnswers([]); } }]
        );
      }
      
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit quiz");
    }
  };

  const renderCourse = (course: Course) => {
    const courseProgress = progress.find((p) => p.course_id === course.id) || null;
    const completionPercentage = getCourseCompletionPercentage(course, courseProgress);
    const isCompleted = courseProgress?.certificate_earned || false;

    return (
      <Pressable
        key={course.id}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedCourse(course);
        }}
        style={({ pressed }) => [
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        className="rounded-2xl p-4 border mb-3"
      >
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-2">
              <Text className="text-3xl">{course.icon}</Text>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-foreground">
                  {course.title}
                </Text>
                <Text className="text-xs text-muted">{course.category}</Text>
              </View>
            </View>
            <Text className="text-sm text-muted mb-2">{course.description}</Text>
            <View className="flex-row gap-3">
              <Text className="text-xs text-muted">
                📚 {course.total_lessons} lessons
              </Text>
              <Text className="text-xs text-muted">
                ⏱️ {course.total_duration_minutes} min
              </Text>
              <Text className="text-xs text-muted capitalize">
                {course.difficulty}
              </Text>
            </View>
          </View>
        </View>

        {courseProgress && (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted">Progress</Text>
              <Text className="text-xs font-semibold text-foreground">
                {completionPercentage}%
              </Text>
            </View>
            <View
              style={{ backgroundColor: colors.border }}
              className="h-2 rounded-full overflow-hidden"
            >
              <View
                style={{
                  backgroundColor: isCompleted ? colors.success : colors.primary,
                  width: `${completionPercentage}%`,
                }}
                className="h-full"
              />
            </View>
          </View>
        )}

        {isCompleted && (
          <View
            style={{ backgroundColor: colors.success + "10" }}
            className="mt-3 p-2 rounded-lg"
          >
            <Text style={{ color: colors.success }} className="text-xs font-semibold text-center">
              ✓ Completed • Certificate Earned
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Financial Literacy
            </Text>
            <Text className="text-sm text-muted">
              Learn, grow, and earn certificates
            </Text>
          </View>

          {/* Stats */}
          {stats && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-2xl mb-1">📚</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.courses_completed}
                </Text>
                <Text className="text-xs text-muted">Completed</Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-2xl mb-1">🎓</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.certificates_earned}
                </Text>
                <Text className="text-xs text-muted">Certificates</Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-2xl mb-1">⏱️</Text>
                <Text className="text-xl font-bold text-foreground">
                  {stats.total_learning_time}
                </Text>
                <Text className="text-xs text-muted">Minutes</Text>
              </View>
            </View>
          )}

          {/* Certificates */}
          {certificates.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                🎓 Your Certificates
              </Text>
              {certificates.map((cert) => (
                <Pressable
                  key={cert.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCertificate(cert);
                    setShowCertificate(true);
                  }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.success + "10",
                      borderColor: colors.success + "30",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="rounded-2xl p-4 border"
                >
                  <Text className="text-base font-semibold text-foreground mb-1">
                    {cert.course_title}
                  </Text>
                  <Text className="text-sm text-muted mb-2">
                    Completed {new Date(cert.completion_date).toLocaleDateString()}
                  </Text>
                  <View
                    style={{ backgroundColor: colors.success + "20" }}
                    className="px-3 py-1 rounded-full self-start"
                  >
                    <Text style={{ color: colors.success }} className="text-xs font-semibold">
                      Score: {cert.score}%
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Courses */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              Available Courses
            </Text>
            {courses.map(renderCourse)}
          </View>
        </View>
      </ScrollView>

      {/* Course Detail Modal */}
      <Modal
        visible={!!selectedCourse && !selectedLesson && !showQuiz}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCourse(null)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          {selectedCourse && (
            <View
              style={{ backgroundColor: colors.background }}
              className="rounded-t-3xl p-6 max-h-5/6"
            >
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2 flex-1">
                  <Text className="text-3xl">{selectedCourse.icon}</Text>
                  <Text className="text-xl font-bold text-foreground flex-1">
                    {selectedCourse.title}
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedCourse(null)}>
                  <Text className="text-2xl text-muted">✕</Text>
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="gap-4">
                  <Text className="text-sm text-muted">{selectedCourse.description}</Text>

                  <View className="gap-2">
                    <Text className="text-base font-semibold text-foreground">Lessons</Text>
                    {selectedCourse.lessons.map((lesson) => {
                      const courseProgress = progress.find((p) => p.course_id === selectedCourse.id);
                      const isCompleted = courseProgress?.completed_lessons.includes(lesson.id) || false;

                      return (
                        <Pressable
                          key={lesson.id}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedLesson(lesson);
                          }}
                          style={({ pressed }) => [
                            {
                              backgroundColor: colors.surface,
                              borderColor: isCompleted ? colors.success : colors.border,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                          className="rounded-xl p-3 border"
                        >
                          <View className="flex-row items-center justify-between">
                            <View className="flex-1">
                              <Text className="text-sm font-semibold text-foreground mb-1">
                                {lesson.order}. {lesson.title}
                              </Text>
                              <Text className="text-xs text-muted">{lesson.duration_minutes} min</Text>
                            </View>
                            {isCompleted && (
                              <Text style={{ color: colors.success }} className="text-xl">✓</Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      const courseProgress = progress.find((p) => p.course_id === selectedCourse.id);
                      if (!courseProgress) {
                        handleStartCourse(selectedCourse);
                      } else if (courseProgress.completed_lessons.length === selectedCourse.lessons.length) {
                        setShowQuiz(true);
                      } else {
                        Alert.alert("Info", "Complete all lessons before taking the quiz");
                      }
                    }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                    className="rounded-xl py-4 mt-2"
                  >
                    <Text
                      style={{ color: colors.background }}
                      className="text-center font-semibold text-base"
                    >
                      {!progress.find((p) => p.course_id === selectedCourse.id)
                        ? "Start Course"
                        : "Take Quiz"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* Lesson Modal */}
      <Modal
        visible={!!selectedLesson}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedLesson(null)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          {selectedLesson && (
            <View
              style={{ backgroundColor: colors.background }}
              className="rounded-t-3xl p-6 max-h-5/6"
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-foreground flex-1">
                  {selectedLesson.title}
                </Text>
                <Pressable onPress={() => setSelectedLesson(null)}>
                  <Text className="text-2xl text-muted">✕</Text>
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                <Text className="text-sm text-foreground leading-relaxed">
                  {selectedLesson.content}
                </Text>
              </ScrollView>

              <Pressable
                onPress={() => {
                  if (selectedCourse) {
                    handleCompleteLesson(selectedCourse.id, selectedLesson.id);
                  }
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="rounded-xl py-4"
              >
                <Text
                  style={{ color: colors.background }}
                  className="text-center font-semibold text-base"
                >
                  Mark as Complete
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* Quiz Modal */}
      <Modal
        visible={showQuiz}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuiz(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          {selectedCourse && (
            <View
              style={{ backgroundColor: colors.background }}
              className="rounded-t-3xl p-6 max-h-5/6"
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-foreground">Quiz</Text>
                <Pressable onPress={() => { setShowQuiz(false); setQuizAnswers([]); }}>
                  <Text className="text-2xl text-muted">✕</Text>
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                <View className="gap-6">
                  {selectedCourse.quiz.map((question, qIndex) => (
                    <View key={question.id} className="gap-3">
                      <Text className="text-sm font-semibold text-foreground">
                        {qIndex + 1}. {question.question}
                      </Text>
                      {question.options.map((option, oIndex) => (
                        <Pressable
                          key={oIndex}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const newAnswers = [...quizAnswers];
                            newAnswers[qIndex] = oIndex;
                            setQuizAnswers(newAnswers);
                          }}
                          style={({ pressed }) => [
                            {
                              backgroundColor:
                                quizAnswers[qIndex] === oIndex
                                  ? colors.primary + "20"
                                  : colors.surface,
                              borderColor:
                                quizAnswers[qIndex] === oIndex
                                  ? colors.primary
                                  : colors.border,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                          className="rounded-xl p-3 border"
                        >
                          <Text
                            style={{
                              color:
                                quizAnswers[qIndex] === oIndex
                                  ? colors.primary
                                  : colors.foreground,
                            }}
                            className="text-sm"
                          >
                            {option}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>

              <Pressable
                onPress={handleSubmitQuiz}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="rounded-xl py-4"
              >
                <Text
                  style={{ color: colors.background }}
                  className="text-center font-semibold text-base"
                >
                  Submit Quiz
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* Certificate Modal */}
      <Modal
        visible={showCertificate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCertificate(false)}
      >
        <View
          className="flex-1 justify-center items-center p-6"
          style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
        >
          {selectedCertificate && (
            <View
              style={{ backgroundColor: colors.background }}
              className="rounded-3xl p-8 w-full max-w-md"
            >
              <View className="items-center gap-4">
                <Text className="text-6xl">🎓</Text>
                <Text className="text-2xl font-bold text-foreground text-center">
                  Certificate of Completion
                </Text>
                <Text className="text-base text-muted text-center">
                  This certifies that
                </Text>
                <Text className="text-xl font-bold text-foreground text-center">
                  {selectedCertificate.user_name}
                </Text>
                <Text className="text-base text-muted text-center">
                  has successfully completed
                </Text>
                <Text className="text-lg font-semibold text-foreground text-center">
                  {selectedCertificate.course_title}
                </Text>
                <View
                  style={{ backgroundColor: colors.success + "20" }}
                  className="px-4 py-2 rounded-full"
                >
                  <Text style={{ color: colors.success }} className="font-semibold">
                    Score: {selectedCertificate.score}%
                  </Text>
                </View>
                <Text className="text-sm text-muted">
                  {new Date(selectedCertificate.completion_date).toLocaleDateString()}
                </Text>

                <Pressable
                  onPress={() => setShowCertificate(false)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  className="rounded-xl py-3 px-8 mt-4"
                >
                  <Text
                    style={{ color: colors.background }}
                    className="font-semibold"
                  >
                    Close
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}
