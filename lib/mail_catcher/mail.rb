require 'active_support/json'
require 'active_record'
require 'mail'
#require 'sqlite3'
require 'eventmachine'
require 'tmpdir'

db_path = File.join(Dir::tmpdir, 'mailcatcherdb')

ActiveRecord::Base.configurations["db"] = { adapter: 'jdbcsqlite3', database: db_path, pool: 20 }

class Message < ActiveRecord::Base
  establish_connection :db
  has_many :message_parts, dependent: :destroy
  self.inheritance_column = nil

  def recipients
    self[:recipients] &&= [ActiveSupport::JSON.decode(self[:recipients])].flatten!
  end
end
class MessagePart < ActiveRecord::Base
  establish_connection :db
  belongs_to :message
  self.inheritance_column = nil
end


Message.connection.create_table :messages do |t|
  t.text :sender
  t.text :recipients
  t.text :subject
  t.binary :source
  t.text :size
  t.text :type

  t.timestamps
end unless Message.table_exists?

MessagePart.connection.create_table :message_parts do |t|
  t.integer :message_id
  t.text :cid
  t.text :type
  t.integer :is_attachment
  t.text :filename
  t.text :charset
  t.binary :body
  t.integer :size
end unless MessagePart.table_exists?

module MailCatcher::Mail extend self

  def add_message(message)
    #@add_message_query ||= db.prepare("INSERT INTO message (sender, recipients, subject, source, type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))")

    mail = Mail.new(message[:source])
    #@add_message_query.execute(message[:sender], message[:recipients].to_json, mail.subject, message[:source], mail.mime_type || 'text/plain', message[:source].length)

    m = Message.create(
      sender: message[:sender],
      recipients: message[:recipients].to_json,
      subject: mail.subject,
      source: message[:source],
      type: mail.mime_type || 'text/plain',
      size: message[:source].length
    )

    #message_id = db.last_insert_row_id
    message_id = m.id
    parts = mail.all_parts
    parts = [mail] if parts.empty?
    parts.each do |part|
      body = part.body.to_s
      # Only parts have CIDs, not mail
      cid = part.cid if part.respond_to? :cid
      #add_message_part(message_id, cid, part.mime_type || 'text/plain', part.attachment? ? 1 : 0, part.filename, part.charset, body, body.length)
      MessagePart.create(
        message_id: message_id,
        cid: cid,
        type: part.mime_type || 'text/plain',
        is_attachment: part.attachment? ? 1 : 0,
        filename: part.filename,
        charset: part.charset,
        body: body,
        size: body.length
      )
    end

    EventMachine.next_tick do
      message = MailCatcher::Mail.message message_id
      MailCatcher::Events::MessageAdded.push message
    end
  end

  #def add_message_part(*args)
    #@add_message_part_query ||= db.prepare "INSERT INTO message_part (message_id, cid, type, is_attachment, filename, charset, body, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    #@add_message_part_query.execute(*args)
  #end

  #def latest_created_at
    #@latest_created_at_query ||= db.prepare "SELECT created_at FROM message ORDER BY created_at DESC LIMIT 1"
    #@latest_created_at_query.execute.next
  #end

  def messages
    Message.all.map(&:attributes)
    #@messages_query ||= db.prepare "SELECT id, sender, recipients, subject, size, created_at FROM message ORDER BY created_at ASC"
    #@messages_query.execute.map do |row|
      #Hash[row.fields.zip(row)].tap do |message|
        #message["recipients"] &&= ActiveSupport::JSON.decode message["recipients"]
      #end
    #end
  end

  def message(id)
    Message.find(id).attributes
    #@message_query ||= db.prepare "SELECT * FROM message WHERE id = ? LIMIT 1"
    #row = @message_query.execute(id).next
    #row && Hash[row.fields.zip(row)].tap do |message|
      #message["recipients"] &&= ActiveSupport::JSON.decode message["recipients"]
    #end
  end

  def message_has_html?(id)
    part = MessagePart.where(message_id: id, is_attachment: 0).where("type IN ('application/xhtml+xml', 'text/html')").first
    part.present? || ['text/html', 'application/xhtml+xml'].include?(Message.find(id).type)
    #@message_has_html_query ||= db.prepare "SELECT 1 FROM message_part WHERE message_id = ? AND is_attachment = 0 AND type IN ('application/xhtml+xml', 'text/html') LIMIT 1"
    #(!!@message_has_html_query.execute(id).next) || ['text/html', 'application/xhtml+xml'].include?(message(id)["type"])
  end

  def message_has_plain?(id)
    part = MessagePart.where(message_id: id, is_attachment: 0, type: 'text/plain').first
    part.present? || Message.find(id).type == 'text/plain'
    #@message_has_plain_query ||= db.prepare "SELECT 1 FROM message_part WHERE message_id = ? AND is_attachment = 0 AND type = 'text/plain' LIMIT 1"
    #(!!@message_has_plain_query.execute(id).next) || message(id)["type"] == "text/plain"
  end

  def message_parts(id)
    MessagePart.where(:message_id => id).order('filename ASC').map(&:attributes)
    #@message_parts_query ||= db.prepare "SELECT cid, type, filename, size FROM message_part WHERE message_id = ? ORDER BY filename ASC"
    #@message_parts_query.execute(id).map do |row|
      #Hash[row.fields.zip(row)]
    #end
  end

  def message_attachments(id)
    MessagePart.where(message_id: id, is_attachment: 1).order('filename ASC').map(&:attributes)
    #@message_parts_query ||= db.prepare "SELECT cid, type, filename, size FROM message_part WHERE message_id = ? AND is_attachment = 1 ORDER BY filename ASC"
    #@message_parts_query.execute(id).map do |row|
      #Hash[row.fields.zip(row)]
    #end
  end

  def message_part(message_id, part_id)
    MessagePart.where(message_id: message_id, id: part_id).first.try(:attributes)
    #@message_part_query ||= db.prepare "SELECT * FROM message_part WHERE message_id = ? AND id = ? LIMIT 1"
    #row = @message_part_query.execute(message_id, part_id).next
    #row && Hash[row.fields.zip(row)]
  end

  def message_part_type(message_id, part_type)
    MessagePart.where(message_id: message_id, type: part_type, is_attachment: 0).first.try(:attributes)
    #@message_part_type_query ||= db.prepare "SELECT * FROM message_part WHERE message_id = ? AND type = ? AND is_attachment = 0 LIMIT 1"
    #row = @message_part_type_query.execute(message_id, part_type).next
    #row && Hash[row.fields.zip(row)]
  end

  def message_part_html(message_id)
    part = message_part_type(message_id, "text/html")
    part ||= message_part_type(message_id, "application/xhtml+xml")
    part ||= begin
      message = message(message_id)
      message if message.present? and ['text/html', 'application/xhtml+xml'].include? message["type"]
    end
  end

  def message_part_plain(message_id)
    message_part_type message_id, "text/plain"
  end

  def message_part_cid(message_id, cid)
    MessagePart.where(message_id: message_id, cid: cid).first.try(:attributes)
    #@message_part_cid_query ||= db.prepare 'SELECT * FROM message_part WHERE message_id = ?'
    #@message_part_cid_query.execute(message_id).map do |row|
      #Hash[row.fields.zip(row)]
    #end.find do |part|
      #part["cid"] == cid
    #end
  end

  def delete!
    Message.destroy_all
    #@delete_messages_query ||= db.prepare 'DELETE FROM message'
    #@delete_message_parts_query ||= db.prepare 'DELETE FROM message_part'

    #@delete_messages_query.execute and
    #@delete_message_parts_query.execute
  end

  def delete_message!(message_id)
    Message.where(id: message_id).destroy_all
    #@delete_messages_query ||= db.prepare 'DELETE FROM message WHERE id = ?'
    #@delete_message_parts_query ||= db.prepare 'DELETE FROM message_part WHERE message_id = ?'
    #@delete_messages_query.execute(message_id) and
    #@delete_message_parts_query.execute(message_id)
  end
end
