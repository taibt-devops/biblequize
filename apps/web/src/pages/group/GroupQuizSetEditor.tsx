// PQS-5 — thin route wrapper that binds the group API + route params to the
// shared QuizSetEditor. The personal route uses PersonalQuizSetEditor instead.
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  addQuestion, createQuizSet, deleteQuestion, getQuizSetFull, publishQuizSet, updateQuestion, updateQuizSet,
} from '../../api/quizSets'
import { api } from '../../api/client'
import QuizSetEditor, { type QuizSetEditorApi } from './QuizSetEditor'

interface Props { mode?: 'create' | 'edit' }

export default function GroupQuizSetEditor({ mode }: Props) {
  const { id: groupId, setId } = useParams<{ id: string; setId?: string }>()
  const [groupName, setGroupName] = useState<string | undefined>(undefined)

  // Best-effort fetch of group name for the editor's top bar.
  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    api.get(`/api/groups/${groupId}`).then(r => {
      if (!cancelled) setGroupName(r.data?.group?.name)
    }).catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [groupId])

  const adapter = useMemo<QuizSetEditorApi>(() => ({
    createQuizSet:     body                 => createQuizSet(groupId!, body),
    updateQuizSet:     (sid, body)          => updateQuizSet(groupId!, sid, body),
    publishQuizSet:    sid                  => publishQuizSet(groupId!, sid),
    getQuizSetFull:    sid                  => getQuizSetFull(groupId!, sid),
    addQuestion:       (sid, body)          => addQuestion(groupId!, sid, body),
    updateQuestion:    (sid, qid, body)     => updateQuestion(groupId!, sid, qid, body),
    deleteQuestion:    (sid, qid)           => deleteQuestion(groupId!, sid, qid).then(total => total),
  }), [groupId])

  if (!groupId) return null

  return (
    <QuizSetEditor
      mode={mode}
      setIdFromRoute={setId}
      ownership="group"
      ownerName={groupName}
      backHref={`/groups/${groupId}`}
      editPathBase={`/groups/${groupId}/quiz-sets/`}
      detailPathBase={`/groups/${groupId}/quiz-sets/`}
      api={adapter}
    />
  )
}
