import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

type QuestionSet = {
  id: string; name: string; description: string;
  visibility: 'PRIVATE' | 'PUBLIC'; questionCount: number;
  createdAt: string; updatedAt: string;
};

const MAX_SETS = 10;

export default function MySets() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-sets'],
    queryFn: () => api.get('/api/question-sets').then(r => r.data),
  });

  const sets: QuestionSet[] = data?.sets ?? [];
  const lockedIds: string[] = data?.locked ?? [];

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description: string }) =>
      api.post('/api/question-sets', body).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['my-sets'] });
      setCreating(false);
      setNewName(''); setNewDesc('');
      navigate(`/my-sets/${res.set.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/question-sets/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-sets'] });
      setDeleteConfirm(null);
    },
  });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), description: newDesc.trim() });
  };

  return (
    <div className="min-h-screen" style={{ background: '#11131e' }}>
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/multiplayer" className="text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-on-surface">Bộ câu hỏi của tôi</h1>
              <p className="text-xs text-on-surface-variant mt-0.5">{sets.length}/{MAX_SETS} bộ</p>
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            disabled={sets.length >= MAX_SETS}
            className="gold-gradient px-4 py-2 rounded-xl text-[#11131e] font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Tạo bộ mới
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div className="glass-card rounded-2xl p-5 mb-5">
            <h3 className="text-sm font-semibold text-on-surface mb-4">Bộ câu hỏi mới</h3>
            <div className="space-y-3">
              <input
                autoFocus
                type="text"
                placeholder="Tên bộ câu hỏi *"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="w-full bg-surface-container-highest rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-secondary/50"
              />
              <input
                type="text"
                placeholder="Mô tả (tuỳ chọn)"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="w-full bg-surface-container-highest rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-secondary/50"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setCreating(false); setNewName(''); setNewDesc(''); }}
                  className="px-4 py-2 rounded-xl text-sm text-on-surface-variant border border-white/10 hover:bg-white/5 transition-colors">
                  Huỷ
                </button>
                <button onClick={handleCreate} disabled={!newName.trim() || createMutation.isPending}
                  className="gold-gradient px-4 py-2 rounded-xl text-sm font-bold text-[#11131e] disabled:opacity-50">
                  {createMutation.isPending ? 'Đang tạo...' : 'Tạo và soạn câu hỏi'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sets grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card rounded-2xl h-36 animate-pulse" />
            ))}
          </div>
        ) : sets.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-3 block">menu_book</span>
            <p className="text-on-surface-variant text-sm">Chưa có bộ câu hỏi nào</p>
            <p className="text-on-surface-variant/60 text-xs mt-1">Tạo bộ đầu tiên để tái sử dụng cho nhiều trận</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sets.map(set => {
              const locked = lockedIds.includes(set.id);
              return (
                <div key={set.id} className="glass-card rounded-2xl p-5 flex flex-col gap-3 relative group">
                  {/* Visibility badge */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      set.visibility === 'PUBLIC'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-white/10 text-on-surface-variant'
                    }`}>
                      {set.visibility === 'PUBLIC' ? 'Public' : 'Riêng tư'}
                    </span>
                    {locked && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">lock</span>
                        Đang dùng
                      </span>
                    )}
                  </div>

                  {/* Name + desc */}
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-on-surface leading-tight">{set.name}</h3>
                    {set.description && (
                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{set.description}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">quiz</span>
                      {set.questionCount} câu
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      {new Date(set.updatedAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link to={`/my-sets/${set.id}`}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-center border border-secondary/40 text-secondary hover:bg-secondary/10 transition-colors">
                      {locked ? 'Xem' : 'Soạn câu hỏi'}
                    </Link>
                    {!locked && (
                      <button
                        onClick={() => setDeleteConfirm(set.id)}
                        className="p-2 rounded-xl border border-white/10 text-on-surface-variant hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete confirm modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="glass-panel rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-base font-bold text-on-surface mb-2">Xoá bộ câu hỏi?</h3>
              <p className="text-sm text-on-surface-variant mb-5">
                Hành động này không thể hoàn tác. Các câu hỏi trong bộ sẽ vẫn còn trong ngân hàng của bạn.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-xl text-sm text-on-surface-variant border border-white/10 hover:bg-white/5 transition-colors">
                  Huỷ
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm!)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-50 transition-colors">
                  {deleteMutation.isPending ? 'Đang xoá...' : 'Xoá'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
