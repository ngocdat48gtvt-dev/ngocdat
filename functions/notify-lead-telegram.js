const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { defineSecret } = require('firebase-functions/params')
const { logger } = require('firebase-functions')

const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')
const telegramChatId = defineSecret('TELEGRAM_CHAT_ID')

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatLeadMessage(leadId, data) {
  const lines = [
    '🆕 <b>Khách đăng ký mới — Landing Page</b>',
    '',
    `<b>Họ tên:</b> ${escapeHtml(data.name)}`,
    `<b>SĐT:</b> ${escapeHtml(data.phone)}`,
    `<b>Email:</b> ${escapeHtml(data.email)}`,
  ]
  if (data.company) lines.push(`<b>Công ty:</b> ${escapeHtml(data.company)}`)
  lines.push(`<b>Địa chỉ:</b> ${escapeHtml(data.province)}`)
  if (data.note) lines.push(`<b>Ghi chú:</b> ${escapeHtml(data.note)}`)
  lines.push('')
  lines.push(`<b>Nguồn:</b> ${escapeHtml(data.source || 'landing_page')}`)
  lines.push(`<b>Lead ID:</b> <code>${escapeHtml(leadId)}</code>`)
  return lines.join('\n')
}

async function sendTelegramMessage(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
  if (!res.ok) {
    throw new Error(`Telegram API ${res.status}: ${await res.text()}`)
  }
}

exports.notifyLeadTelegram = onDocumentCreated(
  {
    document: 'leads/{leadId}',
    secrets: [telegramBotToken, telegramChatId],
  },
  async (event) => {
    const token = telegramBotToken.value()
    const chatId = telegramChatId.value()
    if (!token || !chatId) {
      logger.warn('Telegram chưa cấu hình — bỏ qua thông báo lead')
      return
    }

    const leadId = event.params.leadId
    const data = event.data?.data()
    if (!data) return

    try {
      await sendTelegramMessage(token, chatId, formatLeadMessage(leadId, data))
      logger.info('Đã gửi Telegram cho lead', { leadId })
    } catch (err) {
      logger.error('Gửi Telegram thất bại', { leadId, error: String(err) })
    }
  },
)
