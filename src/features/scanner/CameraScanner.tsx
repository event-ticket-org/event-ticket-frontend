import jsQR from 'jsqr'
import { useEffect, useRef, useState } from 'react'
import { SAME_CODE_COOLDOWN_MS } from './scan-outcomes'
import { ScannerButton } from './scanner-ui'

/**
 * The camera, and the loop that reads QR codes out of it.
 *
 * requirements/007 criterion 2: permission is asked once and codes are read continuously - the
 * operator holds the phone out and the queue moves, rather than pressing a shutter for each
 * person. `active` is how the page stops it: while a verdict is being held or a scan is in
 * flight, frames are still arriving and are simply not decoded. The camera itself never
 * restarts, because a camera that restarts between people is a half-second of black at every
 * scan and a permission prompt on some browsers.
 *
 * The decode happens here rather than in a worker. jsQR on a 640px frame is a few milliseconds,
 * and the honest cost of a worker is a second copy of every frame plus a message round trip -
 * for a budget (criterion 10) that is spent almost entirely on the network.
 */
export function CameraScanner({
  active,
  onCode,
}: {
  active: boolean
  onCode: (code: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'starting' | 'live' | 'blocked'>('starting')
  const [reason, setReason] = useState('')
  const [attempt, setAttempt] = useState(0)

  // Refs, not dependencies. Both change on every scan, and either one in the dependency array
  // would tear the camera down and build it again between one person and the next.
  const activeRef = useRef(active)
  activeRef.current = active
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('blocked')
      // Almost always this and not a missing camera: the API is gone outside a secure
      // context, so a phone pointed at a bare http:// address gets no camera and no error
      // worth reading.
      setReason('This browser will not open a camera here. It needs an https address.')
      return
    }

    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    let lastCode: { code: string; at: number } | null = null
    let lastDecodeAt = 0

    const read = () => {
      frame = requestAnimationFrame(read)
      const now = Date.now()
      // Every frame is more decoding than a person can present codes; ten a second is well
      // inside criterion 10 and leaves the phone with battery for a 45-minute door.
      if (!activeRef.current || !context || now - lastDecodeAt < 100) {
        return
      }
      if (video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) {
        return
      }
      lastDecodeAt = now

      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const image = context.getImageData(0, 0, canvas.width, canvas.height)

      // Ticket QRs are dark on light and never inverted, and trying the inversion doubles the
      // work on every frame that finds nothing - which is most of them.
      const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
      if (!found?.data) {
        return
      }

      // A camera pointed at one code reads it many times a second. The scan endpoint records
      // every attempt and rate-limits per device, so the flood is worth not sending at all.
      if (lastCode && lastCode.code === found.data && now - lastCode.at < SAME_CODE_COOLDOWN_MS) {
        return
      }
      lastCode = { code: found.data, at: now }
      onCodeRef.current(found.data)
    }

    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((opened) => {
        if (stopped) {
          opened.getTracks().forEach((track) => track.stop())
          return
        }
        stream = opened
        video.srcObject = opened
        return video.play()
      })
      .then(() => {
        if (!stopped && stream) {
          setState('live')
          frame = requestAnimationFrame(read)
        }
      })
      .catch((cause: unknown) => {
        if (stopped) {
          return
        }
        setState('blocked')
        setReason(
          cause instanceof DOMException && cause.name === 'NotAllowedError'
            ? 'This browser is blocking the camera. Allow it in the address bar, then try again.'
            : 'No camera answered. Type the code instead.',
        )
      })

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      video.srcObject = null
    }
  }, [attempt])

  if (state === 'blocked') {
    return (
      <div className="flex h-full flex-col justify-center gap-4 border-2 border-chalk bg-night-raised p-4">
        <p className="text-body-strong">The camera is not running.</p>
        <p className="text-body">{reason}</p>
        <ScannerButton onClick={() => setAttempt((n) => n + 1)}>Try the camera again</ScannerButton>
      </div>
    )
  }

  return (
    <div className="relative h-full border-2 border-chalk bg-night-raised">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        muted
        playsInline
        // A camera feed carries no information a screen reader can use, and announcing it
        // would talk over the verdict, which is the thing that matters.
        aria-hidden="true"
      />
      {state === 'starting' && (
        <p className="absolute inset-0 flex items-center justify-center text-body">
          Opening the camera…
        </p>
      )}
      {/* Where to point it. A frame rather than a crosshair: jsQR reads the whole frame, so
          this says "about here" and never implies a target the code has to be inside. */}
      {state === 'live' && (
        <div className="pointer-events-none absolute inset-x-8 top-1/2 aspect-square -translate-y-1/2 border-2 border-chalk" />
      )}
    </div>
  )
}
