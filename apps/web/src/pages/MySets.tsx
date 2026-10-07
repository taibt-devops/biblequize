import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

type QuestionSet = {
  id: string; name: string; description: string;
  visibility: 'PRIVATE' | 'PUBLIC'; questionCount: number;
  createdAt: string; updatedAt: string;
  // PQS-1 metadata (optional — old rows backfilled to PUBLISHED)
  publishStatus?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SOFT_DELETED';
  tags?: string[] | null;
  coverScripture?: string | null;
  coverImageUrl?: string | null;
};

const MAX_SETS = 10;

export default function MySets() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-sets'],
    queryFn: () => api.get('/api/question-sets').then(r => r.data),
  });

  const sets: QuestionSet[] = data?.sets ?? [];
  const lockedIds: string[] = data?.locked ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/question-sets/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-sets'] });
      setDeleteConfirm(null);
    },
  });

  return (
    <div className="min-h-screen bg-bq-paper">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/multiplayer" className="text-bq-ink2 hover:text-bq-ink transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-bq-ink font-display">Bộ câu hỏi của tôi</h1>
              <p className="text-xs text-bq-ink2 mt-0.5">{sets.length}/{MAX_SETS} bộ</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/my-sets/new')}
            disabled={sets.length >= MAX_SETS}
            className="bg-bq-action shadow-bq-action px-4 py-2 rounded-xl text-bq-ink font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Tạo bộ mới
          </button>
        </div>

        {/* Sets grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl h-36 animate-pulse" />
            ))}
          </div>
        ) : sets.length === 0 ? (
          <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-bq-ink3/40 mb-3 block">menu_book</span>
            <p className="text-bq-ink2 text-sm">Chưa có bộ câu hỏi nào</p>
            <p className="text-bq-ink3 text-xs mt-1">Tạo bộ đầu tiên để tái sử dụng cho nhiều trận</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sets.map(set => {
              const locked = lockedIds.includes(set.id);
              const isDraft = set.publishStatus === 'DRAFT';
              const tags = set.tags ?? [];
              return (
                <div key={set.id} className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 flex flex-col gap-3 relative group">
                  {/* Status + locked badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isDraft
                        ? 'bg-bq-amber/20 text-bq-amberd'
                        : 'bg-bq-emerald/20 text-bq-emerald'
                    }`}>
                      {isDraft ? 'NHÁP' : 'ĐÃ XUẤT BẢN'}
                    </span>
                    {locked && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-bq-amber/20 text-bq-amberd flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">lock</span>
                        Đang dùng
                      </span>
                    )}
                  </div>

                  {/* Name + desc */}
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-bq-ink leading-tight">{set.name}</h3>
                    {set.coverScripture && (
                      <p className="text-xs text-bq-amberd/80 mt-1 italic">📖 {set.coverScripture}</p>
                    )}
                    {set.description && (
                      <p className="text-xs text-bq-ink2 mt-1 line-clamp-2">{set.description}</p>
                    )}
                    {tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-bq-inset text-bq-ink2">
                            #{tag}
                          </span>
                        ))}
                        {tags.length > 2 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-bq-ink3">+{tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-bq-ink2">
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
                    <Link to={`/my-sets/${set.id}/edit`}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-center border border-bq-amberd/40 text-bq-amberd hover:bg-bq-amber/10 transition-colors">
                      {locked ? 'Xem' : isDraft ? 'Tiếp tục soạn' : 'Sửa'}
                    </Link>
                    {!locked && (
                      <button
                        onClick={() => setDeleteConfirm(set.id)}
                        className="p-2 rounded-xl border border-bq-hair text-bq-ink2 hover:bg-bq-ruby/10 hover:text-bq-ruby hover:border-bq-ruby/30 transition-colors"
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
            <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-base font-bold text-bq-ink mb-2">Xoá bộ câu hỏi?</h3>
              <p className="text-sm text-bq-ink2 mb-5">
                Hành động này không thể hoàn tác. Các câu hỏi trong bộ sẽ vẫn còn trong ngân hàng của bạn.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-xl text-sm text-bq-ink2 border border-bq-hair hover:bg-bq-inset transition-colors">
                  Huỷ
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm!)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-bq-ruby text-white hover:bg-bq-ruby/90 disabled:opacity-50 transition-colors">
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
