require 'sinatra/base'

$LOAD_PATH.unshift '.', 'lib'

require_relative 'lib/mail_catcher'

run MailCatcher::Web
