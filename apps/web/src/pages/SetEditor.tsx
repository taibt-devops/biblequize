import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

type SetItem = {
  id: string; orderIndex: number; questionId: string;
  content: string; options: string[]; correctAnswer: number;
  difficulty: string; source: string; book: string; explanation: string;
};
type QuestionSet = {
  id: string; name: string; description: string;
  visibility: 'PRIVATE' | 'PUBLIC'; questionCount: number;
};
type UserQuestion = {
  id: string; content: string; options: string[]; correctAnswer: number;
  difficulty: string; source: string; book: string; explanation: string; theme: string;
};

const FILL_1 = { fontVariationSettings: "'FILL' 1" };

// ── Sub-components ─────────────────────────────────────────────────────────

function QuestionCard({
  item, index, locked,
  onEdit, onRemove,
}: {
  item: SetItem; index: number; locked: boolean;
  onEdit: (item: SetItem) => void;
  onRemove: (id: string) => void;
}) {
  const diffColor = item.difficulty === 'HARD' ? 'text-red-400' : item.difficulty === 'EASY' ? 'text-green-400' : 'text-amber-400';
  return (
    <div className="glass-card rounded-xl p-4 flex gap-3">
      <span className="text-xs font-bold text-on-surface-variant w-5 shrink-0 pt-0.5">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-on-surface leading-snug line-clamp-2">{item.content}</p>
        <div className="flex gap-2 mt-1.5 flex-wrap">
          {item.options.map((opt, i) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${i === item.correctAnswer ? 'bg-green-500/20 text-green-400 font-semibold' : 'bg-white/8 text-on-surface-variant'}`}>
              {opt}
            </span>
          ))}
        </div>
        <div className="flex gap-3 mt-1.5 text-xs text-on-surface-variant">
          {item.book && <span>{item.book}</span>}
          <span className={diffColor}>{item.difficulty}</span>
          <span className={item.source === 'AI' ? 'text-purple-400' : 'text-blue-400'}>{item.source}</span>
        </div>
      </div>
      {!locked && (
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-white/10 text-on-surface-variant hover:text-secondary transition-colors">
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button onClick={() => onRemove(item.questionId)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 transition-colors">
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

function EditQuestionModal({
  item, onSave, onClose,
}: {
  item: SetItem; onSave: (updated: Partial<SetItem> & { id: string }) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    content: item.content,
    options: [...item.options],
    correctAnswer: item.correctAnswer,
    difficulty: item.difficulty,
    explanation: item.explanation,
    book: item.book,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.content.trim()) return;
    if (form.options.some(o => !o.trim())) return;
    setSaving(true);
    try {
      await api.put(`/api/user-questions/${item.questionId}`, {
        content: form.content,
        options: form.options,
        correctAnswer: form.correctAnswer,
        difficulty: form.difficulty,
        explanation: form.explanation,
        book: form.book,
      });
      onSave({ ...item, ...form });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="glass-panel rounded-2xl p-6 max-w-lg w-full my-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-on-surface">Sửa câu hỏi</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          {/* Question text */}
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Câu hỏi *</label>
            <textarea rows={3} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              className="w-full bg-surface-container-highest rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-secondary/50 resize-none" />
          </div>

          {/* Options */}
          <div>
            <label className="text-xs text-on-surface-variant mb-2 block">Đáp án (click để chọn đúng)</label>
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <button onClick={() => setForm(p => ({ ...p, correctAnswer: i }))}
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                      form.correctAnswer === i ? 'bg-green-500 text-white' : 'bg-white/10 text-on-surface-variant hover:bg-white/20'
                    }`}>
                    {String.fromCharCode(65 + i)}
                  </button>
                  <input type="text" value={opt}
                    onChange={e => setForm(p => ({ ...p, options: p.options.map((o, j) => j === i ? e.target.value : o) }))}
                    className="flex-1 bg-surface-container-highest rounded-xl px-3 py-1.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-secondary/50" />
                </div>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Độ khó</label>
              <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))}
                className="w-full bg-surface-container-highest rounded-xl px-3 py-2 text-sm text-on-surface outline-none appearance-none">
                {['EASY', 'MEDIUM', 'HARD', 'MIXED'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Sách</label>
              <input type="text" value={form.book} onChange={e => setForm(p => ({ ...p, book: e.target.value }))}
                placeholder="VD: Giăng" className="w-full bg-surface-container-highest rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-secondary/50" />
            </div>
          </div>

          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Giải thích (tuỳ chọn)</label>
            <textarea rows={2} value={form.explanation} onChange={e => setForm(p => ({ ...p, explanation: e.target.value }))}
              className="w-full bg-surface-container-highest rounded-xl px-3 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-secondary/50 resize-none" />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-on-surface-variant border border-white/10 hover:bg-white/5 transition-colors">Huỷ</button>
          <button onClick={handleSave} disabled={saving || !form.content.trim()}
            className="gold-gradient px-4 py-2 rounded-xl text-sm font-bold text-[#11131e] disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function SetEditor() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');
  const [editingItem, setEditingItem] = useState<SetItem | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // AI form
  const [aiForm, setAiForm] = useState({ book: '', chapterStart: '', chapterEnd: '', theme: '', difficulty: 'MIXED', language: 'vi', count: 5 });

  // Manual form
  const [manForm, setManForm] = useState({ content: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'MIXED', explanation: '', book: '' });

  // Set metadata edit
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ name: '', description: '' });

  const flash = (type: 'ok' | 'error', msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 3500);
  };

  const { data, isLoading: pageLoading } = useQuery({
    queryKey: ['set-editor', setId],
    queryFn: () => api.get(`/api/question-sets/${setId}`).then(r => r.data),
    enabled: !!setId,
  });

  const set: QuestionSet | undefined = data?.set;
  const items: SetItem[] = data?.items ?? [];
  const locked: boolean = data?.locked ?? false;

  useEffect(() => {
    if (set) setMetaForm({ name: set.name, description: set.description });
  }, [set]);

  // My question bank (for "add from bank" feature)
  const { data: bankData } = useQuery({
    queryKey: ['my-questions'],
    queryFn: () => api.get('/api/user-questions').then(r => r.data),
  });
  const bank: UserQuestion[] = bankData?.questions ?? [];

  // Already-added IDs
  const addedIds = new Set(items.map(i => i.questionId));

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateMetaMutation = useMutation({
    mutationFn: (body: { name: string; description: string }) =>
      api.put(`/api/question-sets/${setId}`, body).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['set-editor', setId] }); setEditingMeta(false); },
  });

  const visibilityMutation = useMutation({
    mutationFn: (vis: string) =>
      api.patch(`/api/question-sets/${setId}/visibility`, { visibility: vis }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['set-editor', setId] }),
  });

  const addItemMutation = useMutation({
    mutationFn: (questionId: string) =>
      api.post(`/api/question-sets/${setId}/items`, { questionId }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['set-editor', setId] }); flash('ok', 'Đã thêm câu hỏi vào bộ'); },
    onError: (e: any) => flash('error', e?.response?.data?.message || 'Lỗi thêm câu hỏi'),
  });

  const removeItemMutation = useMutation({
    mutationFn: (questionId: string) =>
      api.delete(`/api/question-sets/${setId}/items/${questionId}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['set-editor', setId] }); flash('ok', 'Đã xoá câu hỏi'); },
  });

  const handleGenerateAI = async () => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { difficulty: aiForm.difficulty, language: aiForm.language, count: aiForm.count };
      if (aiForm.book) payload.book = aiForm.book;
      if (aiForm.chapterStart) payload.chapterStart = Number(aiForm.chapterStart);
      if (aiForm.chapterEnd) payload.chapterEnd = Number(aiForm.chapterEnd);
      if (aiForm.theme) payload.theme = aiForm.theme;

      const r = await api.post('/api/user-questions/generate', payload);
      const generated: UserQuestion[] = r.data.questions;

      // Auto-add generated questions to this set
      for (const q of generated) {
        if (!addedIds.has(q.id)) {
          await api.post(`/api/question-sets/${setId}/items`, { questionId: q.id });
        }
      }
      qc.invalidateQueries({ queryKey: ['set-editor', setId] });
      qc.invalidateQueries({ queryKey: ['my-questions'] });
      flash('ok', `Đã tạo và thêm ${generated.length} câu hỏi!`);
    } catch (e: any) {
      flash('error', e?.response?.data?.message || 'Lỗi tạo câu hỏi');
    } finally {
      setLoading(false);
    }
  };

  const handleAddManual = async () => {
    if (!manForm.content.trim() || manForm.options.some(o => !o.trim())) return;
    setLoading(true);
    try {
      const r = await api.post('/api/user-questions', {
        content: manForm.content,
        options: manForm.options,
        correctAnswer: manForm.correctAnswer,
        difficulty: manForm.difficulty,
        explanation: manForm.explanation,
        book: manForm.book,
        language: 'vi',
      });
      const q: UserQuestion = r.data.question;
      await api.post(`/api/question-sets/${setId}/items`, { questionId: q.id });
      qc.invalidateQueries({ queryKey: ['set-editor', setId] });
      qc.invalidateQueries({ queryKey: ['my-questions'] });
      setManForm({ content: '', options: ['', '', '', ''], correctAnswer: 0, difficulty: 'MIXED', explanation: '', book: '' });
      flash('ok', 'Đã thêm câu hỏi thủ công!');
    } catch (e: any) {
      flash('error', e?.response?.data?.message || 'Lỗi thêm câu hỏi');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSave = (updated: Partial<SetItem> & { id: string }) => {
    qc.invalidateQueries({ queryKey: ['set-editor', setId] });
    setEditingItem(null);
    flash('ok', 'Đã lưu câu hỏi');
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#11131e' }}>
        <span className="material-symbols-outlined animate-spin text-4xl text-secondary">progress_activity</span>
      </div>
    );
  }
  if (!set) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#11131e' }}>
        <p className="text-on-surface-variant">Không tìm thấy bộ câu hỏi</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#11131e' }}>
      {/* Toast */}
      {notice && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
          notice.type === 'ok' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
        }`}>{notice.msg}</div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link to="/my-sets" className="text-on-surface-variant hover:text-on-surface mt-1 transition-colors shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex-1 min-w-0">
            {editingMeta ? (
              <div className="flex gap-2 flex-wrap">
                <input autoFocus value={metaForm.name} onChange={e => setMetaForm(p => ({ ...p, name: e.target.value }))}
                  className="bg-surface-container-highest rounded-xl px-3 py-1.5 text-base font-bold text-on-surface outline-none focus:ring-2 focus:ring-secondary/50 flex-1 min-w-0" />
                <input value={metaForm.description} onChange={e => setMetaForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Mô tả..." className="bg-surface-container-highest rounded-xl px-3 py-1.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-secondary/50 flex-1 min-w-0" />
                <button onClick={() => updateMetaMutation.mutate(metaForm)} disabled={!metaForm.name.trim()}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold gold-gradient text-[#11131e] disabled:opacity-50">Lưu</button>
                <button onClick={() => setEditingMeta(false)} className="px-3 py-1.5 rounded-xl text-xs text-on-surface-variant border border-white/10">Huỷ</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-on-surface truncate">{set.name}</h1>
                {!locked && (
                  <button onClick={() => setEditingMeta(true)} className="text-on-surface-variant hover:text-secondary transition-colors">
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-xs text-on-surface-variant">{set.questionCount} câu hỏi</span>
              {locked && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">lock</span>Đang dùng trong phòng
                </span>
              )}
              {!locked && (
                <button onClick={() => visibilityMutation.mutate(set.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')}
                  className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                    set.visibility === 'PUBLIC'
                      ? 'border-green-500/40 text-green-400 hover:bg-green-500/10'
                      : 'border-white/20 text-on-surface-variant hover:bg-white/5'
                  }`}>
                  {set.visibility === 'PUBLIC' ? '🌐 Public' : '🔒 Riêng tư'} — đổi
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Question list */}
          <div>
            <h2 className="text-sm font-semibold text-on-surface mb-3">
              Danh sách câu hỏi ({items.length})
            </h2>
            {items.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 block mb-2">quiz</span>
                <p className="text-sm text-on-surface-variant">Chưa có câu hỏi nào</p>
                <p className="text-xs text-on-surface-variant/60 mt-1">Dùng tab bên phải để tạo câu hỏi</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
                {items.map((item, i) => (
                  <QuestionCard key={item.id} item={item} index={i} locked={locked}
                    onEdit={setEditingItem} onRemove={id => removeItemMutation.mutate(id)} />
                ))}
              </div>
            )}
          </div>

          {/* Right: Create panel */}
          {!locked && (
            <div>
              {/* Tabs */}
              <div className="flex bg-surface-container-highest rounded-xl p-1 mb-4">
                {(['ai', 'manual'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === tab ? 'gold-gradient text-[#11131e]' : 'text-on-surface-variant hover:text-on-surface'
                    }`}>
                    {tab === 'ai' ? '✨ AI tạo' : '✏️ Thủ công'}
                  </button>
                ))}
              </div>

              {activeTab === 'ai' ? (
                <div className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Sách Kinh Thánh</label>
                      <input type="text" value={aiForm.book} onChange={e => setAiForm(p => ({ ...p, book: e.target.value }))}
                        placeholder="VD: Giăng..." className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50" />
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Chủ đề</label>
                      <input type="text" value={aiForm.theme} onChange={e => setAiForm(p => ({ ...p, theme: e.target.value }))}
                        placeholder="VD: tình yêu thương..." className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Chương từ</label>
                      <input type="number" min={1} value={aiForm.chapterStart} onChange={e => setAiForm(p => ({ ...p, chapterStart: e.target.value }))}
                        placeholder="1" className="w-full bg-surface-container-highest rounded-lg px-2 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50" />
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Đến chương</label>
                      <input type="number" min={1} value={aiForm.chapterEnd} onChange={e => setAiForm(p => ({ ...p, chapterEnd: e.target.value }))}
                        placeholder="3" className="w-full bg-surface-container-highest rounded-lg px-2 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50" />
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Số câu</label>
                      <select value={aiForm.count} onChange={e => setAiForm(p => ({ ...p, count: Number(e.target.value) }))}
                        className="w-full bg-surface-container-highest rounded-lg px-2 py-2 text-xs text-on-surface outline-none appearance-none">
                        {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Độ khó</label>
                      <select value={aiForm.difficulty} onChange={e => setAiForm(p => ({ ...p, difficulty: e.target.value }))}
                        className="w-full bg-surface-container-highest rounded-lg px-2 py-2 text-xs text-on-surface outline-none appearance-none">
                        {['EASY', 'MEDIUM', 'HARD', 'MIXED'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Ngôn ngữ</label>
                      <select value={aiForm.language} onChange={e => setAiForm(p => ({ ...p, language: e.target.value }))}
                        className="w-full bg-surface-container-highest rounded-lg px-2 py-2 text-xs text-on-surface outline-none appearance-none">
                        <option value="vi">Tiếng Việt</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={handleGenerateAI} disabled={loading}
                    className="w-full gold-gradient h-10 rounded-xl text-[#11131e] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading
                      ? <><span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>Đang tạo...</>
                      : <><span className="material-symbols-outlined text-lg" style={FILL_1}>auto_awesome</span>Tạo với AI</>}
                  </button>
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-4 space-y-3">
                  <div>
                    <label className="text-xs text-on-surface-variant mb-1 block">Câu hỏi *</label>
                    <textarea rows={3} value={manForm.content} onChange={e => setManForm(p => ({ ...p, content: e.target.value }))}
                      placeholder="Nhập câu hỏi..." className="w-full bg-surface-container-highest rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs text-on-surface-variant mb-1 block">Đáp án (click để chọn đúng)</label>
                    <div className="space-y-1.5">
                      {manForm.options.map((opt, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <button onClick={() => setManForm(p => ({ ...p, correctAnswer: i }))}
                            className={`w-6 h-6 rounded-full shrink-0 text-xs font-bold transition-all ${manForm.correctAnswer === i ? 'bg-green-500 text-white' : 'bg-white/10 text-on-surface-variant'}`}>
                            {String.fromCharCode(65 + i)}
                          </button>
                          <input value={opt} onChange={e => setManForm(p => ({ ...p, options: p.options.map((o, j) => j === i ? e.target.value : o) }))}
                            placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                            className="flex-1 bg-surface-container-highest rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Độ khó</label>
                      <select value={manForm.difficulty} onChange={e => setManForm(p => ({ ...p, difficulty: e.target.value }))}
                        className="w-full bg-surface-container-highest rounded-lg px-2 py-2 text-xs text-on-surface outline-none appearance-none">
                        {['EASY', 'MEDIUM', 'HARD', 'MIXED'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant mb-1 block">Sách</label>
                      <input value={manForm.book} onChange={e => setManForm(p => ({ ...p, book: e.target.value }))}
                        placeholder="VD: Giăng" className="w-full bg-surface-container-highest rounded-lg px-2.5 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-secondary/50" />
                    </div>
                  </div>
                  <button onClick={handleAddManual} disabled={loading || !manForm.content.trim() || manForm.options.some(o => !o.trim())}
                    className="w-full h-9 rounded-xl text-sm font-bold border border-secondary/40 text-secondary hover:bg-secondary/10 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    Thêm câu hỏi
                  </button>
                </div>
              )}

              {/* Add from bank */}
              {bank.filter(q => !addedIds.has(q.id)).length > 0 && (
                <details className="mt-4">
                  <summary className="text-xs text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors select-none">
                    Thêm từ ngân hàng câu hỏi ({bank.filter(q => !addedIds.has(q.id)).length} có sẵn)
                  </summary>
                  <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
                    {bank.filter(q => !addedIds.has(q.id)).map(q => (
                      <div key={q.id} className="flex items-start gap-2 p-2.5 glass-card rounded-xl">
                        <p className="text-xs text-on-surface flex-1 line-clamp-2">{q.content}</p>
                        <button onClick={() => addItemMutation.mutate(q.id)}
                          className="shrink-0 px-2 py-1 rounded-lg text-xs text-secondary border border-secondary/30 hover:bg-secondary/10 transition-colors">
                          Thêm
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editingItem && (
        <EditQuestionModal item={editingItem} onSave={handleEditSave} onClose={() => setEditingItem(null)} />
      )}
    </div>
  );
}
