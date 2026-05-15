import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App shell', () => {
  it('renders the AI Image Station login screen by default', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /AI Image Station/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Access Code/i)).toBeInTheDocument()
  })

  it('navigates between main product pages after a mocked login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { token: 'session-token', expiresAt: '2026-05-15T12:00:00Z' } }),
    }))

    render(<App />)
    await userEvent.type(screen.getByLabelText(/Access Code/i), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /进入工作站/i }))

    expect(await screen.findByRole('heading', { name: /生成图片/i })).toBeInTheDocument()

    const galleryButtons = screen.getAllByRole('button', { name: /图片画廊/i })
    await userEvent.click(galleryButtons[0])
    expect(screen.getByRole('heading', { name: /图片画廊/i })).toBeInTheDocument()

    const settingsButtons = screen.getAllByRole('button', { name: /设置/i })
    await userEvent.click(settingsButtons[0])
    expect(screen.getByRole('heading', { name: /^设置$/i, level: 1 })).toBeInTheDocument()
  })
})
