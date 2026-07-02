import { ApplyOptions } from '@sapphire/decorators'
import { Piece } from '@sapphire/framework'
import Task from '../../lib/mods/Task'
import { IThread } from '../../database/Thread'
import { escapeHtml } from '../../lib/util/utilities'

@ApplyOptions<Piece.Options>({ name: 'generatetranscript' })
export class GenerateTranscript extends Task {
	private client = this.container.client

	public async exec(thread: IThread): Promise<string> {
		const guild = this.client.guilds.cache.get(thread.guildId)
		const user = await this.client.users.fetch(thread.userId).catch(() => null)
		const staffAnonymous: boolean = this.client.settings.get(thread.guildId, 'thread.anonymous', false)

		const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Modmail Transcript - ${thread.threadId}</title>
    <style>
        body {
            font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background: #36393f;
            color: #dcddde;
            padding: 20px;
            margin: 0;
        }
        .header {
            background: #202225;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0 0 10px 0;
            color: #ffffff;
        }
        .header .info {
            color: #b9bbbe;
            font-size: 14px;
        }
        .messages {
            background: #2f3136;
            border-radius: 8px;
            padding: 20px;
        }
        .message {
            display: flex;
            padding: 15px 0;
            border-bottom: 1px solid #40444b;
        }
        .message:last-child {
            border-bottom: none;
        }
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 15px;
            background: #5865F2;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            flex-shrink: 0;
        }
        .avatar.staff {
            background: #57F287;
        }
        .content {
            flex: 1;
        }
        .author {
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 5px;
        }
        .author .badge {
            background: #5865F2;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            margin-left: 5px;
        }
        .author .badge.staff {
            background: #57F287;
        }
        .timestamp {
            color: #72767d;
            font-size: 12px;
            margin-left: 5px;
        }
        .message-text {
            margin-top: 5px;
            line-height: 1.5;
            word-wrap: break-word;
        }
        .attachments {
            background: #202225;
            padding: 10px;
            margin-top: 10px;
            border-radius: 3px;
            border-left: 4px solid #5865F2;
        }
        .attachments a {
            color: #00b0f4;
            text-decoration: none;
        }
        .attachments a:hover {
            text-decoration: underline;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            color: #72767d;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📨 Modmail Transcript</h1>
        <div class="info">
            <strong>Thread ID:</strong> ${thread.threadId}<br>
            <strong>User:</strong> ${user?.tag || 'Unknown'} (${thread.userId})<br>
            <strong>Guild:</strong> ${guild?.name || 'Unknown'}<br>
            <strong>Created:</strong> ${thread.createdAt.toLocaleString()}<br>
            <strong>Closed:</strong> ${thread.closedAt?.toLocaleString() || 'N/A'}<br>
            <strong>Closed By:</strong> ${thread.closedBy || 'N/A'}<br>
            <strong>Total Messages:</strong> ${thread.messages.length}
        </div>
    </div>
    <div class="messages">
        ${thread.messages
					.map((msg) => {
						const displayName = msg.isStaff && staffAnonymous ? 'Staff' : !msg.isStaff && thread.userAnonymous ? 'Anonymous User' : msg.authorTag
						const initial = displayName.charAt(0).toUpperCase()
						return `
            <div class="message">
                <div class="avatar ${msg.isStaff ? 'staff' : ''}">${initial}</div>
                <div class="content">
                    <div class="author">
                        ${displayName}
                        <span class="badge ${msg.isStaff ? 'staff' : ''}">${msg.isStaff ? 'STAFF' : 'USER'}</span>
                        <span class="timestamp">${msg.timestamp.toLocaleString()}</span>
                    </div>
                    <div class="message-text">${escapeHtml(msg.content)}</div>
                    ${
						msg.attachments.length > 0 ? `
                        <div class="attachments">
                            📎 <strong>Attachments:</strong><br>
                            ${msg.attachments.map((url, i) => `<a href="${url}" target="_blank">Attachment ${i + 1}</a>`).join('<br>')}
                        </div>
                    `
					    : ''
					}
                </div>
            </div>
            `
					})
					.join('')
        }
    </div>
    <div class="footer">
        Generated by Vikala Modmail System • ${new Date().toLocaleString()}
    </div>
</body>
</html>
        `.trim()

		return html
	}
}
