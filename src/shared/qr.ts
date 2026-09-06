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
const COLOURS = { dark: '#14110f', light: '#fdfbf4' }

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
      color: COLOURS,
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
    color: COLOURS,
  })
}
