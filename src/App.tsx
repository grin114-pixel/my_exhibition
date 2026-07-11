import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import headerIcon from './assets/header-icon.png'
import {
  type Database,
  getSupabaseClient,
  isSupabaseConfigured,
  storageBucket,
} from './lib/supabase'

type ExhibitionRecord = Database['public']['Tables']['exhibitions']['Row']

type ExhibitionView = ExhibitionRecord & {
  effectiveDate: Date
}

type ExhibitionFormState = {
  name: string
  place: string
  link: string
  memo: string
  expiresAt: string
  imageFile: File | null
  imagePreview: string | null
  removeImage: boolean
}

function getTodayInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getEmptyForm(): ExhibitionFormState {
  return {
    name: '',
    place: '',
    link: '',
    memo: '',
    expiresAt: getTodayInputValue(),
    imageFile: null,
    imagePreview: null,
    removeImage: false,
  }
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDateLabel(date: Date) {
  const year = String(date.getFullYear()).slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

function formatDateDisplay(value: string) {
  if (!value) {
    return ''
  }

  const [year, month, day] = value.split('-')
  return `${year}.${month}.${day}`
}

function normalizeLink(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed}`
}

function getStoragePathFromPublicUrl(imageUrl: string) {
  const marker = `/object/public/${storageBucket}/`
  const markerIndex = imageUrl.indexOf(marker)

  if (markerIndex === -1) {
    return null
  }

  const encodedPath = imageUrl.slice(markerIndex + marker.length)
  return decodeURIComponent(encodedPath.split('?')[0] ?? '')
}

async function deleteExhibitionImage(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return
  }

  const filePath = getStoragePathFromPublicUrl(imageUrl)

  if (!filePath) {
    return
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase.storage.from(storageBucket).remove([filePath])

  if (error) {
    throw error
  }
}

function normalizeExhibition(exhibition: ExhibitionRecord): ExhibitionView {
  const effectiveDate = parseLocalDate(exhibition.expires_at)

  return {
    ...exhibition,
    link: exhibition.link ?? '',
    memo: exhibition.memo ?? '',
    effectiveDate,
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('이미지 미리보기를 만들 수 없어요.'))
    }

    reader.onerror = () => reject(new Error('이미지를 읽는 중 오류가 발생했어요.'))
    reader.readAsDataURL(file)
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

function sortExhibitions(exhibitions: ExhibitionView[]) {
  return [...exhibitions].sort((left, right) => {
    return left.effectiveDate.getTime() - right.effectiveDate.getTime()
  })
}

function autoResizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) {
    return
  }

  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

function App() {
  const [exhibitions, setExhibitions] = useState<ExhibitionView[]>([])
  const [isLoadingExhibitions, setIsLoadingExhibitions] = useState(false)
  const [dataError, setDataError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [exhibitionPendingDelete, setExhibitionPendingDelete] = useState<ExhibitionView | null>(null)
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null)
  const [editingExhibition, setEditingExhibition] = useState<ExhibitionView | null>(null)
  const [form, setForm] = useState<ExhibitionFormState>(() => getEmptyForm())
  const [isSaving, setIsSaving] = useState(false)
  const nameTextareaRef = useRef<HTMLTextAreaElement>(null)
  const memoTextareaRef = useRef<HTMLTextAreaElement>(null)

  const supabaseReady = isSupabaseConfigured()

  useEffect(() => {
    if (!statusMessage) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setStatusMessage('')
    }, 2500)

    return () => window.clearTimeout(timeoutId)
  }, [statusMessage])

  useEffect(() => {
    if (!isModalOpen) {
      return
    }

    autoResizeTextarea(nameTextareaRef.current)
    autoResizeTextarea(memoTextareaRef.current)
  }, [isModalOpen, form.name, form.memo])

  const loadExhibitions = useCallback(async () => {
    if (!supabaseReady) {
      setDataError('Supabase 환경 변수가 설정되지 않았어요. `.env`를 먼저 채워 주세요.')
      setExhibitions([])
      return
    }

    setIsLoadingExhibitions(true)
    setDataError('')

    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('exhibitions')
        .select('id, name, place, link, memo, expires_at, is_recurring, image_url')
        .order('expires_at', { ascending: true })

      if (error) {
        throw error
      }

      const normalizedExhibitions = sortExhibitions(
        ((data ?? []) as ExhibitionRecord[]).map(normalizeExhibition),
      )
      setExhibitions(normalizedExhibitions)
    } catch (error) {
      setDataError(getErrorMessage(error))
      setExhibitions([])
    } finally {
      setIsLoadingExhibitions(false)
    }
  }, [supabaseReady])

  useEffect(() => {
    void (async () => {
      await loadExhibitions()
    })()
  }, [loadExhibitions])

  function resetForm() {
    setForm(getEmptyForm())
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingExhibition(null)
    resetForm()
  }

  function openCreateModal() {
    setEditingExhibition(null)
    resetForm()
    setIsModalOpen(true)
  }

  function openEditModal(exhibition: ExhibitionView) {
    setEditingExhibition(exhibition)
    setForm({
      name: exhibition.name,
      place: exhibition.place,
      link: exhibition.link,
      memo: exhibition.memo,
      expiresAt: exhibition.expires_at,
      imageFile: null,
      imagePreview: exhibition.image_url,
      removeImage: false,
    })
    setIsModalOpen(true)
  }

  function handleNameChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setForm((current) => ({ ...current, name: event.target.value }))
    autoResizeTextarea(event.target)
  }

  function handlePlaceChange(event: ChangeEvent<HTMLInputElement>) {
    setForm((current) => ({ ...current, place: event.target.value }))
  }

  function handleLinkChange(event: ChangeEvent<HTMLInputElement>) {
    setForm((current) => ({ ...current, link: event.target.value }))
  }

  function handleMemoChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setForm((current) => ({ ...current, memo: event.target.value }))
    autoResizeTextarea(event.target)
  }

  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    setForm((current) => ({ ...current, expiresAt: event.target.value }))
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const preview = await readFileAsDataUrl(file)
      setForm((current) => ({
        ...current,
        imageFile: file,
        imagePreview: preview,
        removeImage: false,
      }))
    } catch (error) {
      setDataError(getErrorMessage(error))
    }
  }

  function handleImageRemove() {
    setForm((current) => ({
      ...current,
      imageFile: null,
      imagePreview: null,
      removeImage: true,
    }))
  }

  async function uploadExhibitionImage(file: File) {
    const supabase = getSupabaseClient()
    const fileName = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    const { error } = await supabase.storage.from(storageBucket).upload(fileName, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/*',
      upsert: false,
    })

    if (error) {
      throw error
    }

    return supabase.storage.from(storageBucket).getPublicUrl(fileName).data.publicUrl
  }

  async function handleSaveExhibition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabaseReady) {
      setDataError('Supabase 환경 변수가 설정되지 않아 저장할 수 없어요.')
      return
    }

    if (!form.name.trim()) {
      setDataError('전시명을 입력해 주세요.')
      return
    }

    if (!form.expiresAt) {
      setDataError('날짜를 선택해 주세요.')
      return
    }

    setIsSaving(true)
    setDataError('')

    try {
      const supabase = getSupabaseClient()
      const previousImageUrl = editingExhibition?.image_url ?? null
      let imageUrl = previousImageUrl

      if (form.removeImage) {
        imageUrl = null
      }

      if (form.imageFile) {
        imageUrl = await uploadExhibitionImage(form.imageFile)
      }

      const payload = {
        name: form.name.trim(),
        place: form.place.trim(),
        link: normalizeLink(form.link),
        memo: form.memo.trim(),
        expires_at: form.expiresAt,
        is_recurring: false,
        image_url: imageUrl,
      }

      if (editingExhibition) {
        const { error } = await supabase
          .from('exhibitions')
          .update(payload)
          .eq('id', editingExhibition.id)

        if (error) {
          throw error
        }

        setStatusMessage('전시 일정을 수정했어요.')
      } else {
        const { error } = await supabase.from('exhibitions').insert(payload)

        if (error) {
          throw error
        }

        setStatusMessage('전시 일정을 등록했어요.')
      }

      if (previousImageUrl && previousImageUrl !== imageUrl) {
        await deleteExhibitionImage(previousImageUrl)
      }

      closeModal()
      await loadExhibitions()
    } catch (error) {
      setDataError(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteExhibition(exhibition: ExhibitionView) {
    if (!supabaseReady) {
      setDataError('Supabase 환경 변수가 설정되지 않아 삭제할 수 없어요.')
      return
    }

    setDataError('')

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from('exhibitions').delete().eq('id', exhibition.id)

      if (error) {
        throw error
      }

      await deleteExhibitionImage(exhibition.image_url)

      setStatusMessage('전시 일정을 삭제했어요.')
      await loadExhibitions()
    } catch (error) {
      setDataError(getErrorMessage(error))
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-title">
          <div className="app-icon">
            <img src={headerIcon} alt="" />
          </div>
          <h1>Exhibition</h1>
        </div>
      </header>

      {!supabaseReady ? (
        <section className="notice-card">
          <h2>Supabase 연결이 필요해요</h2>
          <p>`.env`에 URL, Anon Key 값을 넣은 뒤 다시 실행해 주세요.</p>
          <p>테이블과 스토리지 설정은 `supabase-schema.sql` 파일에 정리해 두었습니다.</p>
        </section>
      ) : null}

      {dataError ? (
        <section className="notice-card error-card">
          <h2>처리 중 문제가 생겼어요</h2>
          <p>{dataError}</p>
        </section>
      ) : null}

      {statusMessage ? <div className="toast-message">{statusMessage}</div> : null}

      <main className="content-area">
        {isLoadingExhibitions ? (
          <section className="empty-state">
            <p>전시 일정을 불러오는 중입니다...</p>
          </section>
        ) : null}

        {!isLoadingExhibitions && exhibitions.length === 0 ? (
          <section className="empty-state">
            <div className="empty-illustration">
              <GalleryIcon />
            </div>
            <h2>아직 등록된 전시가 없어요</h2>
            <p>하단의 + 버튼을 눌러 첫 번째 전시 일정을 추가해 보세요.</p>
          </section>
        ) : null}

        {!isLoadingExhibitions && exhibitions.length > 0 ? (
          <div className="exhibition-list">
            {exhibitions.map((exhibition) => (
              <section key={exhibition.id} className="exhibition-item">
                <div className="exhibition-item-header">
                  <h2 className="card-date">{formatDateLabel(exhibition.effectiveDate)}</h2>
                  <div className="card-header-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="전시 수정"
                      onClick={() => openEditModal(exhibition)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="전시 삭제"
                      onClick={() => setExhibitionPendingDelete(exhibition)}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </div>

                <article className="exhibition-card">
                  <div className="exhibition-card-body">
                    <div className="exhibition-copy">
                      {exhibition.is_recurring ? (
                        <div className="exhibition-meta">
                          <span className="chip">매달 반복</span>
                        </div>
                      ) : null}
                      <h3>{exhibition.name}</h3>
                      {exhibition.memo ? (
                        <p className="exhibition-memo">
                          <MemoIcon />
                          <span>{exhibition.memo}</span>
                        </p>
                      ) : null}
                      {exhibition.place ? (
                        exhibition.link ? (
                          <a
                            className="exhibition-place exhibition-place-link"
                            href={normalizeLink(exhibition.link)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <PlaceIcon />
                            <span>{exhibition.place}</span>
                          </a>
                        ) : (
                          <p className="exhibition-place">
                            <PlaceIcon />
                            <span>{exhibition.place}</span>
                          </p>
                        )
                      ) : null}
                    </div>

                    <div className="exhibition-visual">
                      {exhibition.image_url ? (
                        <button
                          type="button"
                          className="image-button"
                          aria-label={`${exhibition.name} 원본 이미지 보기`}
                          onClick={() => setSelectedImage({ url: exhibition.image_url!, name: exhibition.name })}
                        >
                          <img src={exhibition.image_url} alt={`${exhibition.name} 썸네일`} />
                        </button>
                      ) : (
                        <div className="exhibition-placeholder">
                          <ImageIcon />
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </section>
            ))}
          </div>
        ) : null}
      </main>

      <button
        type="button"
        className="fab-button"
        aria-label="전시 등록"
        onClick={openCreateModal}
        disabled={!supabaseReady}
      >
        <PlusIcon />
      </button>

      {isModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              {editingExhibition ? (
                <div>
                  <p className="eyebrow">전시 수정</p>
                  <h2>전시 정보를 바꿔보세요</h2>
                </div>
              ) : (
                <div />
              )}
              <button type="button" className="icon-button" aria-label="팝업 닫기" onClick={closeModal}>
                <CloseIcon />
              </button>
            </div>

            <form className="exhibition-form" onSubmit={handleSaveExhibition}>
              <label className="field">
                <span>전시명</span>
                <textarea
                  ref={nameTextareaRef}
                  className="field-textarea"
                  rows={1}
                  value={form.name}
                  onChange={handleNameChange}
                />
              </label>

              <label className="field">
                <span>장소</span>
                <input
                  type="text"
                  value={form.place}
                  onChange={handlePlaceChange}
                />
              </label>

              <label className="field">
                <span>링크</span>
                <input
                  type="url"
                  inputMode="url"
                  value={form.link}
                  onChange={handleLinkChange}
                />
              </label>

              <label className="field">
                <span>메모</span>
                <textarea
                  ref={memoTextareaRef}
                  className="field-textarea"
                  rows={1}
                  value={form.memo}
                  onChange={handleMemoChange}
                />
              </label>

              <label className="field">
                <span>날짜</span>
                <div className="date-field">
                  <span className="date-field-display">{formatDateDisplay(form.expiresAt)}</span>
                  <input type="date" value={form.expiresAt} onChange={handleDateChange} />
                </div>
              </label>

              <label className="field">
                <span>이미지 첨부</span>
                <input type="file" accept="image/*" onChange={handleImageChange} />
              </label>

              {form.imagePreview ? (
                <div className="preview-panel">
                  <img src={form.imagePreview} alt="업로드 미리보기" />
                  <button type="button" className="text-button" onClick={handleImageRemove}>
                    이미지 제거
                  </button>
                </div>
              ) : null}

              <div className="modal-actions">
                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? '저장 중...' : editingExhibition ? '수정 저장' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {exhibitionPendingDelete ? (
        <div className="modal-overlay" role="presentation" onClick={() => setExhibitionPendingDelete(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">전시 삭제</p>
                <h2>이 전시를 삭제할까요?</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="삭제 확인 닫기"
                onClick={() => setExhibitionPendingDelete(null)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setExhibitionPendingDelete(null)}>
                취소
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  void (async () => {
                    const target = exhibitionPendingDelete
                    setExhibitionPendingDelete(null)
                    if (!target) return
                    await handleDeleteExhibition(target)
                  })()
                }}
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedImage ? (
        <div className="modal-overlay image-viewer-overlay" role="presentation" onClick={() => setSelectedImage(null)}>
          <div
            className="image-viewer-card"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedImage.name} 원본 이미지`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="icon-button image-viewer-close"
              aria-label="원본 이미지 닫기"
              onClick={() => setSelectedImage(null)}
            >
              <CloseIcon />
            </button>
            <img src={selectedImage.url} alt={`${selectedImage.name} 원본`} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="4.5" width="14" height="13" rx="1.6" fill="currentColor" opacity="0.18" />
      <rect x="5" y="4.5" width="14" height="13" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9.3" cy="9" r="1.3" fill="currentColor" />
      <path
        d="m6.6 14.6 3.2-3.2 2.3 2 2.6-3 2.7 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.5 20.5h7M12 17.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function PlaceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="meta-icon">
      <path
        d="M12 21s-6.5-5.79-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.21 12 21 12 21Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.5" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function MemoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="meta-icon">
      <path
        d="M7 4.75h7.2L17.5 8v11.25H7V4.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14 4.75V8h3.5M9.5 12h5M9.5 15.25h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path
        d="m7 16 3.5-3.5L13 15l2-2 2 3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m5 16.75 9.8-9.8a1.8 1.8 0 0 1 2.55 0l.7.7a1.8 1.8 0 0 1 0 2.55L8.25 20H5v-3.25Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5.5 7.5h13M9.5 4.75h5l.75 2.75m-8 0 .55 9.2A2 2 0 0 0 9.8 18.6h4.4a2 2 0 0 0 1.99-1.9l.56-9.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m7 7 10 10M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export default App
