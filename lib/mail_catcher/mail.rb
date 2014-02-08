require 'active_support/json'
require 'active_record'
require 'mail'
require 'eventmachine'
require 'tmpdir'

db_path = File.join(Dir::tmpdir, 'mailcatcherdb')

#ActiveRecord::Base.configurations["db"] = { adapter: 'jdbcsqlite3', database: db_path, pool: 5 }
ActiveRecord::Base.establish_connection({ adapter: 'jdbcsqlite3', database: db_path, pool: 5 })

class Message < ActiveRecord::Base
  #establish_connection :db
  has_many :message_parts, dependent: :destroy
  self.inheritance_column = nil

  def recipients
    self[:recipients] &&= [ActiveSupport::JSON.decode(self[:recipients])].flatten!
  end
end
class MessagePart < ActiveRecord::Base
  #establish_connection :db
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

    mail = Mail.new(message[:source])

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

  def messages
    Message.all.map(&:attributes)
  end

  def message(id)
    Message.find(id).attributes
  end

  def message_has_html?(id)
    part = MessagePart.where(message_id: id, is_attachment: 0).where("type IN ('application/xhtml+xml', 'text/html')").first
    part.present? || ['text/html', 'application/xhtml+xml'].include?(Message.find(id).type)
  end

  def message_has_plain?(id)
    part = MessagePart.where(message_id: id, is_attachment: 0, type: 'text/plain').first
    part.present? || Message.find(id).type == 'text/plain'
  end

  def message_parts(id)
    MessagePart.where(:message_id => id).order('filename ASC').map(&:attributes)
  end

  def message_attachments(id)
    MessagePart.where(message_id: id, is_attachment: 1).order('filename ASC').map(&:attributes)
  end

  def message_part(message_id, part_id)
    MessagePart.where(message_id: message_id, id: part_id).first.try(:attributes)
  end

  def message_part_type(message_id, part_type)
    MessagePart.where(message_id: message_id, type: part_type, is_attachment: 0).first.try(:attributes)
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
  end

  def delete!
    Message.destroy_all
  end

  def delete_message!(message_id)
    Message.where(id: message_id).destroy_all
  end
end
