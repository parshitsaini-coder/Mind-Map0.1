import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Bold, Italic, Underline as UnderlineIcon, Link2, Paperclip, Mic, Square, Video as VideoIcon, X } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

function extractYoutubeId(url) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/)
  return m ? m[1] : null
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function ToolbarBtn({ icon: Icon, active, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded p-1 ${active ? 'bg-[#f5cb5c]' : 'hover:bg-[#cfdbd5]/60'}`}
    >
      <Icon size={12} />
    </button>
  )
}

export default function NotesEditor({ nodeId, data }) {
  const updateNodeData = useMapStore((s) => s.updateNodeData)
  const [recording, setRecording] = useState(false)
  const [videoInput, setVideoInput] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: data.notes || '',
    onUpdate: ({ editor }) => updateNodeData(nodeId, { notes: editor.getHTML() }),
  })

  // Re-sync editor content if a different node gets selected.
  useEffect(() => {
    if (editor && editor.getHTML() !== (data.notes || '')) {
      editor.commands.setContent(data.notes || '', { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  const setLink = () => {
    const url = window.prompt('Link URL')
    if (url) editor?.chain().focus().setLink({ href: url }).run()
  }

  const handleAttachment = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    const attachments = [...(data.attachments || []), { name: file.name, size: file.size, dataUrl }]
    updateNodeData(nodeId, { attachments })
  }

  const removeAttachment = (idx) => {
    const attachments = (data.attachments || []).filter((_, i) => i !== idx)
    updateNodeData(nodeId, { attachments })
  }

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const dataUrl = await fileToDataUrl(blob)
        updateNodeData(nodeId, { audioNote: dataUrl })
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      window.alert('Microphone access is needed to record an audio note.')
    }
  }

  const attachVideo = () => {
    const id = extractYoutubeId(videoInput)
    if (id) {
      updateNodeData(nodeId, { videoEmbed: id })
      setVideoInput('')
    } else {
      window.alert("Couldn't find a YouTube video ID in that link.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Rich text notes */}
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Notes</p>
        <div className="rounded-md border border-[#cfdbd5] bg-white/50">
          <div className="flex gap-0.5 border-b border-[#cfdbd5] p-1">
            <ToolbarBtn icon={Bold} title="Bold" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} />
            <ToolbarBtn icon={Italic} title="Italic" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} />
            <ToolbarBtn icon={UnderlineIcon} title="Underline" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
            <ToolbarBtn icon={Link2} title="Hyperlink" active={editor?.isActive('link')} onClick={setLink} />
          </div>
          <EditorContent editor={editor} className="prose-sm max-h-32 min-h-[60px] overflow-y-auto px-2 py-1 text-[11px] [&_.ProseMirror]:outline-none [&_a]:text-blue-600 [&_a]:underline" />
        </div>
      </div>

      {/* File attachments */}
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Attachments</p>
        <label className="flex w-fit cursor-pointer items-center gap-1 rounded-md border border-dashed border-[#333533] px-2 py-1 text-[10px] hover:bg-[#cfdbd5]/30">
          <Paperclip size={10} /> Attach file
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleAttachment} className="hidden" />
        </label>
        <ul className="mt-1 flex flex-col gap-1">
          {(data.attachments || []).map((att, i) => (
            <li key={i} className="flex items-center justify-between rounded bg-[#cfdbd5]/30 px-1.5 py-0.5 text-[10px]">
              <a href={att.dataUrl} download={att.name} className="truncate hover:underline">{att.name}</a>
              <button onClick={() => removeAttachment(i)}><X size={10} /></button>
            </li>
          ))}
        </ul>
      </div>

      {/* Audio note */}
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Audio note</p>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] ${
              recording ? 'border-red-500 bg-red-500/10 text-red-600' : 'border-[#333533]'
            }`}
          >
            {recording ? <Square size={10} /> : <Mic size={10} />}
            {recording ? 'Stop' : 'Record'}
          </button>
          {data.audioNote && <audio controls src={data.audioNote} className="h-6 max-w-[140px]" />}
        </div>
      </div>

      {/* YouTube video embed */}
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#333533]">Video embed</p>
        {data.videoEmbed ? (
          <div className="relative">
            <iframe
              className="aspect-video w-full rounded-md"
              src={`https://www.youtube.com/embed/${data.videoEmbed}`}
              title="YouTube video"
              allowFullScreen
            />
            <button
              onClick={() => updateNodeData(nodeId, { videoEmbed: null })}
              className="absolute -top-2 -right-2 rounded-full bg-[#e8eddf] p-0.5 shadow"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <div className="flex gap-1">
            <input
              value={videoInput}
              onChange={(e) => setVideoInput(e.target.value)}
              placeholder="Paste YouTube link…"
              className="flex-1 rounded-md border border-[#cfdbd5] bg-white/60 px-2 py-1 text-[10px] outline-none focus:border-[#f5cb5c]"
            />
            <button onClick={attachVideo} className="rounded-md border border-[#333533] px-2" title="Embed">
              <VideoIcon size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
