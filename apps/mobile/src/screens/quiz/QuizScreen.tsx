import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, Animated, Alert, BackHandler } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import SafeScreen from '../../components/layout/SafeScreen'
import ProgressBar from '../../components/ui/ProgressBar'
import { apiClient } from '../../api/client'
import { calculateScore } from '../../logic/scoring'
import { useHaptic } from '../../hooks/useHaptic'
import { colors, typography, spacing, borderRadius } from '../../theme'

const LETTERS = ['A', 'B', 'C', 'D']

// Per-position colour for the Answer Color Mapping (web parity, QZ-P0-1).
// rgb triplets so we can use rgba() for varying opacity per state.
const POS_RGB = [
  '232,130,106', // A — Coral  (#E8826A)
  '106,184,232', // B — Sky    (#6AB8E8)
  '232,199,106', // C — Gold   (#E8C76A)
  '122,184,122', // D — Sage   (#7AB87A)
] as const

// True/False questions render only 2 answers — per spec they map to A
// (Coral) + D (Sage), skipping Sky + Gold so the contrast is maximal.
function colorPositionFor(idx: number, total: number): number {
  if (total === 2) return idx === 0 ? 0 : 3
  return idx
}

/**
 * Format a verse reference for the badge above the question (QZ-P0-2).
 * Mirrors `apps/web/src/utils/textHelpers.ts#formatVerseRef`. Kept inline
 * here rather than imported to avoid pulling React-DOM utils into the
 * RN bundle.
 */
function formatVerseRef(q: { book: string; chapter?: number; verseStart?: number; verseEnd?: number }): string {
  const book = q.book.toUpperCase()
  if (!q.chapter) return book
  if (!q.verseStart) return `${book} ${q.chapter}`
  if (q.verseEnd && q.verseEnd !== q.verseStart) {
    return `${book} ${q.chapter}:${q.verseStart}-${q.verseEnd}`
  }
  return `${book} ${q.chapter}:${q.verseStart}`
}

export default function QuizScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { trigger: haptic } = useHaptic()
  const { questions = [], sessionId, mode = 'practice', timePerQuestion = 30, showExplanation = true } = route.params ?? {}

  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [timeLeft, setTimeLeft] = useState(timePerQuestion)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>(new Array(questions.length).fill(null))
  const [questionScores, setQuestionScores] = useState<number[]>(new Array(questions.length).fill(0))

  const question = questions[qIndex]
  const progress = questions.length > 0 ? ((qIndex + 1) / questions.length) * 100 : 0

  // Back button quit confirmation
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(t('quiz.quitTitle'), t('quiz.quitConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.yes'), style: 'destructive', onPress: () => navigation.goBack() },
      ])
      return true
    })
    return () => handler.remove()
  }, [navigation, t])

  // Timer
  useEffect(() => {
    if (timeLeft > 0 && !showResult) {
      const timer = setTimeout(() => setTimeLeft((t: number) => t - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !showResult) {
      handleSelect(-1)
    }
  }, [timeLeft, showResult])

  const handleSelect = useCallback(async (idx: number) => {
    if (showResult) return
    setSelected(idx)
    setShowResult(true)

    const correct = idx === (question?.correctAnswer?.[0] ?? -1)
    setIsCorrect(correct)

    // Haptic feedback
    if (correct) haptic('success')
    else haptic('error')

    let qScore = 0
    if (correct) {
      qScore = calculateScore({
        difficulty: question.difficulty,
        isCorrect: true,
        elapsedMs: (timePerQuestion - timeLeft) * 1000,
        timeLimitMs: timePerQuestion * 1000,
        comboCount: combo,
        tierMultiplier: 1.0, // TODO: fetch real tier multiplier from /api/me
      })
      setScore(s => s + qScore)
      setCombo(c => c + 1)
      setCorrectCount(c => c + 1)
    } else {
      setCombo(0)
    }

    // Record answer
    const newAnswers = [...userAnswers]
    newAnswers[qIndex] = idx
    setUserAnswers(newAnswers)
    const newScores = [...questionScores]
    newScores[qIndex] = qScore
    setQuestionScores(newScores)

    // Submit to server
    if (sessionId) {
      try {
        await apiClient.post(`/api/sessions/${sessionId}/answer`, {
          questionId: question.id,
          answer: idx,
          clientElapsedMs: (timePerQuestion - timeLeft) * 1000,
        })
      } catch { /* non-critical */ }
    }
  }, [showResult, question, combo, timeLeft, qIndex, userAnswers, questionScores, sessionId, timePerQuestion])

  const nextQuestion = () => {
    if (qIndex + 1 >= questions.length) {
      const stats = {
        totalScore: score,
        correctAnswers: correctCount,
        totalQuestions: questions.length,
        accuracy: questions.length > 0 ? (correctCount / questions.length) * 100 : 0,
        questions,
        userAnswers,
        questionScores,
      }
      navigation.replace('QuizResults', { stats })
    } else {
      setQIndex(i => i + 1)
      setSelected(null)
      setShowResult(false)
      setIsCorrect(null)
      setTimeLeft(timePerQuestion)
    }
  }

  if (!question) return null

  return (
    <SafeScreen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => Alert.alert(t('quiz.quitTitle'), t('quiz.quitConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.yes'), style: 'destructive', onPress: () => navigation.goBack() },
          ])} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.qCount}>{qIndex + 1}/{questions.length}</Text>
          </View>
          <View style={styles.comboBadge}>
            <Text style={styles.comboText}>🔥 {combo}</Text>
          </View>
        </View>

        <ProgressBar progress={progress} height={4} />

        {/* Timer */}
        <View style={styles.timerRow}>
          <Text style={[styles.timerText, timeLeft <= 5 && styles.timerWarning]}>
            {timeLeft}s
          </Text>
          <Text style={styles.bookLabel}>{question.book} {question.chapter}</Text>
        </View>

        {/* Question — verse badge top + question text (QZ-P0-2 mobile parity). */}
        <View style={styles.questionCard}>
          <View style={styles.verseBadge}>
            <Text style={styles.verseBadgeText}>{formatVerseRef(question)}</Text>
          </View>
          <Text style={styles.questionText}>{question.content}</Text>
        </View>

        {/* Answers — per-position colour mapping (Coral/Sky/Gold/Sage), QZ-P0-1.
            Reveal states (correct=green, wrong=red) override the position colour. */}
        <View style={styles.answers}>
          {question.options?.map((opt: string, idx: number) => {
            const isSel = selected === idx
            const isRight = showResult && idx === question.correctAnswer?.[0]
            const isWrong = showResult && isSel && idx !== question.correctAnswer?.[0]
            const total = question.options?.length ?? 0
            const rgb = POS_RGB[colorPositionFor(idx, total)]

            // Default = subtle position tint; selected = stronger; eliminated/
            // disabled inherits default + opacity (handled in JSX below).
            const useReveal = isRight || isWrong
            const positionStyle = useReveal
              ? null
              : isSel
                ? { borderColor: `rgb(${rgb})`, backgroundColor: `rgba(${rgb},0.20)` }
                : { borderColor: `rgba(${rgb},0.30)`, backgroundColor: `rgba(${rgb},0.10)` }

            return (
              <Pressable
                key={idx}
                onPress={() => handleSelect(idx)}
                disabled={showResult}
                style={[
                  styles.answerBtn,
                  positionStyle,
                  isRight && styles.ansCorrect,
                  isWrong && styles.ansWrong,
                ]}
              >
                <View
                  style={[
                    styles.letter,
                    !useReveal && { backgroundColor: `rgba(${rgb},0.30)` },
                    isRight && styles.letterCorrect,
                    isWrong && styles.letterWrong,
                  ]}
                >
                  <Text
                    style={[
                      styles.letterText,
                      !useReveal && { color: `rgb(${rgb})` },
                      (isRight || isWrong) && { color: colors.onSecondary },
                    ]}
                  >
                    {LETTERS[idx]}
                  </Text>
                </View>
                <Text style={[styles.ansText, isRight && { color: colors.success }, isWrong && { color: colors.error }]} numberOfLines={2}>
                  {opt}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Result footer */}
        {showResult && (
          <View style={[styles.resultBar, isCorrect ? styles.resultCorrect : styles.resultWrong]}>
            <View>
              <Text style={styles.resultTitle}>{isCorrect ? '✓ Chính xác!' : '✗ Sai rồi!'}</Text>
              {!isCorrect && showExplanation && question.explanation && (
                <Text style={styles.explanation} numberOfLines={2}>{question.explanation}</Text>
              )}
            </View>
            <Pressable onPress={nextQuestion} style={styles.nextBtn}>
              <Text style={styles.nextText}>{qIndex + 1 >= questions.length ? 'Kết quả' : 'Tiếp →'}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeScreen>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 18, color: colors.textMuted },
  headerCenter: { alignItems: 'center' },
  qCount: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.textSecondary },
  comboBadge: { backgroundColor: colors.surfaceContainer, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  comboText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gold },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.lg },
  timerText: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.gold },
  timerWarning: { color: colors.error },
  bookLabel: { fontSize: typography.size.xs, color: colors.textMuted },
  questionCard: {
    backgroundColor: colors.surfaceContainer, borderRadius: borderRadius['2xl'],
    padding: spacing.xl, marginBottom: spacing.xl, minHeight: 100, justifyContent: 'center',
    alignItems: 'center',
  },
  verseBadge: {
    backgroundColor: 'rgba(232,168,50,0.10)',
    borderColor: 'rgba(232,168,50,0.20)',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  verseBadgeText: {
    color: colors.gold,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    letterSpacing: 1,
  },
  questionText: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.textPrimary, textAlign: 'center', lineHeight: 30 },
  answers: { gap: spacing.md, flex: 1 },
  answerBtn: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.lg,
    backgroundColor: colors.surfaceContainer, borderRadius: borderRadius.xl,
    borderWidth: 2, borderColor: 'transparent',
  },
  // ansSelected dropped — per-position selected style now inline (uses
  // POS_RGB so the gold accent matches the position colour).
  ansCorrect: { borderColor: colors.success, backgroundColor: 'rgba(34,197,94,0.1)' },
  ansWrong: { borderColor: colors.error, backgroundColor: 'rgba(239,68,68,0.1)' },
  letter: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  letterCorrect: { backgroundColor: colors.success },
  letterWrong: { backgroundColor: colors.error },
  letterText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.gold },
  ansText: { flex: 1, fontSize: typography.size.base, color: colors.textPrimary },
  resultBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderRadius: borderRadius.xl, marginTop: spacing.md,
  },
  resultCorrect: { backgroundColor: 'rgba(34,197,94,0.15)' },
  resultWrong: { backgroundColor: 'rgba(239,68,68,0.15)' },
  resultTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.textPrimary },
  explanation: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 4, maxWidth: 220 },
  nextBtn: { backgroundColor: colors.gold, borderRadius: borderRadius.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  nextText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.onSecondary },
})
