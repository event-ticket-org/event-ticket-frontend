import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { NextAction as NextActionShape } from '~/api/types'
import { Card } from '~/shared/ui'

/**
 * Whatever the provider said to do next, rendered without knowing which provider said it.
 *
 * requirements/005 criterion 2, and ADR-0002. There is deliberately no branch on the
 * provider's name anywhere here: a redirect, a QR to display and a hosted page are three
 * flows, and the abstraction exists because providers differ in flow rather than merely in
 * credentials. Adding `if (provider === 'STRIPE')` would quietly undo that.
 */
export function NextAction({ action }: { action: NextActionShape }) {
  switch (action.type) {
    case 'DISPLAY_QR':
      return <QrTransfer payload={action.qrPayload ?? ''} reference={action.reference} />
    case 'REDIRECT':
    case 'HOSTED_CHECKOUT':
      return <SendThemOn url={action.url} hosted={action.type === 'HOSTED_CHECKOUT'} />
    case 'NONE':
      return (
        <Card>
          <p className="text-body">
            Nothing more to do here — we are waiting for the payment to clear.
          </p>
        </Card>
      )
  }
}

function SendThemOn({ url, hosted }: { url?: string | null; hosted: boolean }) {
  if (!url) {
    return (
      <Card>
        <p className="text-body">
          The payment provider did not send us anywhere to go. Try starting the payment again.
        </p>
      </Card>
    )
  }
  return (
    <Card>
      <p className="max-w-[68ch] text-body">
        {hosted
          ? 'Payment happens on the provider’s own page. You will come back here when it is done.'
          : 'Your bank or wallet will take it from here.'}
      </p>
      <a
        href={url}
        className="mt-4 inline-flex min-h-11 items-center justify-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost"
      >
        Continue to pay
      </a>
      <p className="mt-3 text-body text-ink-soft">
        {/* Criterion 3, said plainly: coming back here is not what confirms the order. */}
        Coming back to this page does not confirm the payment — the provider tells us
        directly, and this page updates when they do.
      </p>
    </Card>
  )
}

/**
 * A bank transfer QR, which is the flow this market actually uses.
 *
 * The reference matters as much as the code: a transfer that arrives without its memo cannot
 * be matched to an Order, so it is shown as text, in the numeric face, large enough to copy
 * by hand from a phone in the other hand.
 */
function QrTransfer({ payload, reference }: { payload: string; reference?: string | null }) {
  const svg = useQrSvg(payload)

  return (
    <Card>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div
          className="size-60 shrink-0 border-2 border-ink bg-paper p-3"
          // The QR is the payment instruction; a scanner needs its quiet zone intact, so it
          // is never cropped, masked or decorated.
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
          aria-label="Scan this with your banking app to pay"
        />
        <div className="space-y-4">
          <p className="max-w-[68ch] text-body">
            Scan this with your banking app. The amount and the reference are already in the
            code.
          </p>
          {reference && (
            <div>
              <p className="text-label uppercase text-ink-soft">Transfer reference</p>
              <p className="font-numeric text-numeric-lg">{reference}</p>
              <p className="mt-1 max-w-[68ch] text-body text-ink-soft">
                If you type the transfer in by hand, include this. Without it we cannot tell
                which order the money belongs to.
              </p>
            </div>
          )}
          <p className="text-body text-ink-soft">
            This page updates by itself when the payment arrives. You do not need to come back
            and tell us.
          </p>
        </div>
      </div>
    </Card>
  )
}

/** Rendered to SVG rather than canvas, so it stays crisp and prints. */
function useQrSvg(payload: string): string {
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
      color: { dark: '#14110f', light: '#fdfbf4' },
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

export { useQrSvg }
