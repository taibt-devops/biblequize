// PQS-6 — route wrapper that binds the personal API adapter to the shared
// QuizSetEditor. Mounted at /my-sets/new and /my-sets/:setId/edit.
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  addQuestion, createQuizSet, deleteQuestion,
  getQuizSetFull, publishQuizSet, updateQuestion, updateQuizSet,
} from '../api/personalQuizSets'
import QuizSetEditor, { type QuizSetEditorApi } from './group/QuizSetEditor'

interface Props { mode?: 'create' | 'edit' }

export default function PersonalQuizSetEditor({ mode }: Props) {
  const { setId } = useParams<{ setId?: string }>()

  const adapter = useMemo<QuizSetEditorApi>(() => ({
    createQuizSet,
    updateQuizSet,
    publishQuizSet,
    getQuizSetFull,
    addQuestion,
    updateQuestion,
    deleteQuestion,
  }), [])

  return (
    <QuizSetEditor
      mode={mode}
      setIdFromRoute={setId}
      ownership="personal"
      ownerName="Bộ của tôi"
      backHref="/my-sets"
      editPathBase="/my-sets/"
      detailPathBase="/my-sets/"
      api={adapter}
    />
  )
}
