import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * QR codes, rendered in the browser and never fetched.
 *
 * That is a requirement rather than an optimisation. `nfr.md`: a Ticket Code is never written
 * to a log and never put in a URL - a URL carrying one lands in access logs, proxy logs and
 * browser history. Asking a server to draw the image would put the code in a request line;
 * drawing it here means the code reaches the page in a response body and goes no further.
 */
/**
 * On the page the light modules are transparent, so the surface underneath is the quiet zone -
 * `{colors.paper}` on a screen and white on paper, without the colour being baked into the
 * image at the moment it is drawn. A cream quiet zone printed at 240px square on every ticket
 * is a lot of ink for a tint the sheet already provides.
 *
 * A downloaded PNG keeps an opaque one. That file leaves this application and is looked at
 * wherever the person it was sent to looks at things - a transparent QR over a dark background
 * is a QR nothing can read.
 */
const ON_PAGE = { dark: '#14110f', light: '#0000' }
const IN_A_FILE = { dark: '#14110f', light: '#fdfbf4' }

export function useQrSvg(payload: string): string {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let current = true
    if (!payload) {
      setSvg('')
      return
    }
    void QRCode.toString(payload, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 0,
      color: ON_PAGE,
    }).then((rendered) => {
      if (current) {
        setSvg(rendered.replace('<svg', '<svg class="size-full"'))
      }
    })
    return () => {
      current = false
    }
  }, [payload])

  return svg
}

/**
 * A PNG the buyer can save and send on (requirements/006 criterion 4).
 *
 * A data URL, so the file is produced by the page rather than requested from anywhere. The
 * quiet zone is kept - a scanner needs it, and this image is the difference between somebody
 * getting in and not.
 */
export function qrPngDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 720,
    color: IN_A_FILE,
  })
}
