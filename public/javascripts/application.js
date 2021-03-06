(function() {
  var MailCatcher,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  jQuery.expr[':'].icontains = function(a, i, m) {
    var _ref, _ref1;
    return ((_ref = (_ref1 = a.textContent) != null ? _ref1 : a.innerText) != null ? _ref : "").toUpperCase().indexOf(m[3].toUpperCase()) >= 0;
  };

  MailCatcher = (function() {
    function MailCatcher() {
      this.nextTab = __bind(this.nextTab, this);
      this.previousTab = __bind(this.previousTab, this);
      this.openTab = __bind(this.openTab, this);
      this.selectedTab = __bind(this.selectedTab, this);
      this.getTab = __bind(this.getTab, this);
      $('#messages tr').live('click', (function(_this) {
        return function(e) {
          e.preventDefault();
          return _this.loadMessage($(e.currentTarget).attr('data-message-id'));
        };
      })(this));
      $('input[name=search]').keyup((function(_this) {
        return function(e) {
          var query;
          query = $.trim($(e.currentTarget).val());
          if (query) {
            return _this.searchMessages(query);
          } else {
            return _this.clearSearch();
          }
        };
      })(this));
      $('#message .views .format.tab a').live('click', (function(_this) {
        return function(e) {
          e.preventDefault();
          return _this.loadMessageBody(_this.selectedMessage(), $($(e.currentTarget).parent('li')).data('message-format'));
        };
      })(this));
      $('#message .views .analysis.tab a').live('click', (function(_this) {
        return function(e) {
          e.preventDefault();
          return _this.loadMessageAnalysis(_this.selectedMessage());
        };
      })(this));
      $('#message iframe').load((function(_this) {
        return function() {
          return _this.decorateMessageBody();
        };
      })(this));
      $('#resizer').live({
        mousedown: (function(_this) {
          return function(e) {
            var events;
            e.preventDefault();
            return $(window).bind(events = {
              mouseup: function(e) {
                e.preventDefault();
                return $(window).unbind(events);
              },
              mousemove: function(e) {
                e.preventDefault();
                return _this.resizeTo(e.clientY);
              }
            });
          };
        })(this)
      });
      this.resizeToSaved();
      $('nav.app .clear a').live('click', (function(_this) {
        return function(e) {
          e.preventDefault();
          if (confirm("You will lose all your received messages.\n\nAre you sure you want to clear all messages?")) {
            return $.ajax({
              url: '/messages',
              type: 'DELETE',
              success: function() {
                return _this.unselectMessage();
              },
              error: function() {
                return alert('Error while clearing all messages.');
              }
            });
          }
        };
      })(this));
      $('nav.app .quit a').live('click', (function(_this) {
        return function(e) {
          e.preventDefault();
          if (confirm("You will lose all your received messages.\n\nAre you sure you want to quit?")) {
            return $.ajax({
              type: 'DELETE',
              success: function() {
                return location.replace($('body > header h1 a').attr('href'));
              },
              error: function() {
                return alert('Error while quitting.');
              }
            });
          }
        };
      })(this));
      key('up', (function(_this) {
        return function() {
          if (_this.selectedMessage()) {
            _this.loadMessage($('#messages tr.selected').prev().data('message-id'));
          } else {
            _this.loadMessage($('#messages tbody tr[data-message-id]:first').data('message-id'));
          }
          return false;
        };
      })(this));
      key('down', (function(_this) {
        return function() {
          if (_this.selectedMessage()) {
            _this.loadMessage($('#messages tr.selected').next().data('message-id'));
          } else {
            _this.loadMessage($('#messages tbody tr[data-message-id]:first').data('message-id'));
          }
          return false;
        };
      })(this));
      key('⌘+up, ctrl+up', (function(_this) {
        return function() {
          _this.loadMessage($('#messages tbody tr[data-message-id]:first').data('message-id'));
          return false;
        };
      })(this));
      key('⌘+down, ctrl+down', (function(_this) {
        return function() {
          _this.loadMessage($('#messages tbody tr[data-message-id]:last').data('message-id'));
          return false;
        };
      })(this));
      key('left', (function(_this) {
        return function() {
          _this.openTab(_this.previousTab());
          return false;
        };
      })(this));
      key('right', (function(_this) {
        return function() {
          _this.openTab(_this.nextTab());
          return false;
        };
      })(this));
      key('backspace, delete', (function(_this) {
        return function() {
          var id;
          id = _this.selectedMessage();
          if (id != null) {
            $.ajax({
              url: '/messages/' + id,
              type: 'DELETE',
              success: function() {
                var messageRow, switchTo;
                messageRow = $("#messages tbody tr[data-message-id='" + id + "']");
                switchTo = messageRow.next().data('message-id') || messageRow.prev().data('message-id');
                messageRow.remove();
                if (switchTo) {
                  return _this.loadMessage(switchTo);
                } else {
                  return _this.unselectMessage();
                }
              },
              error: function() {
                return alert('Error while removing message.');
              }
            });
          }
          return false;
        };
      })(this));
      this.refresh();
      this.subscribe();
    }

    MailCatcher.prototype.parseDateRegexp = /^(\d{4})[-\/\\](\d{2})[-\/\\](\d{2})(?:\s+|T)(\d{2})[:-](\d{2})[:-](\d{2})(?:([ +-]\d{2}:\d{2}|\s*\S+|Z?))?$/;

    MailCatcher.prototype.parseDate = function(date) {
      var match;
      if (match = this.parseDateRegexp.exec(date)) {
        return new Date(match[1], match[2] - 1, match[3], match[4], match[5], match[6], 0);
      }
    };

    MailCatcher.prototype.offsetTimeZone = function(date) {
      var offset;
      offset = Date.now().getTimezoneOffset() * 60000;
      date.setTime(date.getTime() - offset);
      return date;
    };

    MailCatcher.prototype.formatDate = function(date) {
      if (typeof date === "string") {
        date && (date = this.parseDate(date));
      }
      date && (date = this.offsetTimeZone(date));
      return date && (date = date.toString("dddd, d MMM yyyy h:mm:ss tt"));
    };

    MailCatcher.prototype.messagesCount = function() {
      return $('#messages tr').length - 1;
    };

    MailCatcher.prototype.tabs = function() {
      return $('#message ul').children('.tab');
    };

    MailCatcher.prototype.getTab = function(i) {
      return $(this.tabs()[i]);
    };

    MailCatcher.prototype.selectedTab = function() {
      return this.tabs().index($('#message li.tab.selected'));
    };

    MailCatcher.prototype.openTab = function(i) {
      return this.getTab(i).children('a').click();
    };

    MailCatcher.prototype.previousTab = function(tab) {
      var i;
      i = tab || tab === 0 ? tab : this.selectedTab() - 1;
      if (i < 0) {
        i = this.tabs().length - 1;
      }
      if (this.getTab(i).is(":visible")) {
        return i;
      } else {
        return this.previousTab(i - 1);
      }
    };

    MailCatcher.prototype.nextTab = function(tab) {
      var i;
      i = tab ? tab : this.selectedTab() + 1;
      if (i > this.tabs().length - 1) {
        i = 0;
      }
      if (this.getTab(i).is(":visible")) {
        return i;
      } else {
        return this.nextTab(i + 1);
      }
    };

    MailCatcher.prototype.haveMessage = function(message) {
      if (message.id != null) {
        message = message.id;
      }
      return $("#messages tbody tr[data-message-id=\"" + message + "\"]").length > 0;
    };

    MailCatcher.prototype.selectedMessage = function() {
      return $('#messages tr.selected').data('message-id');
    };

    MailCatcher.prototype.searchMessages = function(query) {
      var $rows, selector, token;
      selector = ((function() {
        var _i, _len, _ref, _results;
        _ref = query.split(/\s+/);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          token = _ref[_i];
          _results.push(":icontains('" + token + "')");
        }
        return _results;
      })()).join("");
      $rows = $("#messages tbody tr");
      $rows.not(selector).hide();
      return $rows.filter(selector).show();
    };

    MailCatcher.prototype.clearSearch = function() {
      return $('#messages tbody tr').show();
    };

    MailCatcher.prototype.addMessage = function(message) {
      return $('#messages tbody').prepend($('<tr />').attr('data-message-id', message.id.toString())).append($('<td/>').text(message.sender || "No sender").toggleClass("blank", !message.sender)).append($('<td/>').text((message.recipients || []).join(', ') || "No recipients").toggleClass("blank", !message.recipients.length)).append($('<td/>').text(message.subject || "No subject").toggleClass("blank", !message.subject)).append($('<td/>').text(this.formatDate(message.created_at)));
    };

    MailCatcher.prototype.scrollToRow = function(row) {
      var overflow, relativePosition;
      relativePosition = row.offset().top - $('#messages').offset().top;
      if (relativePosition < 0) {
        return $('#messages').scrollTop($('#messages').scrollTop() + relativePosition - 20);
      } else {
        overflow = relativePosition + row.height() - $('#messages').height();
        if (overflow > 0) {
          return $('#messages').scrollTop($('#messages').scrollTop() + overflow + 20);
        }
      }
    };

    MailCatcher.prototype.unselectMessage = function() {
      $('#messages tbody, #message .metadata dd').empty();
      $('#message .metadata .attachments').hide();
      $('#message iframe').attr('src', 'about:blank');
      return null;
    };

    MailCatcher.prototype.loadMessage = function(id) {
      var messageRow;
      if ((id != null ? id.id : void 0) != null) {
        id = id.id;
      }
      id || (id = $('#messages tr.selected').attr('data-message-id'));
      if (id != null) {
        $("#messages tbody tr:not([data-message-id='" + id + "'])").removeClass('selected');
        messageRow = $("#messages tbody tr[data-message-id='" + id + "']");
        messageRow.addClass('selected');
        this.scrollToRow(messageRow);
        return $.getJSON("/messages/" + id + ".json", (function(_this) {
          return function(message) {
            var $ul;
            if (message.recipients != null) {
              message.recipients = JSON.parse(message.recipients);
            }
            $('#message .metadata dd.created_at').text(_this.formatDate(message.created_at));
            $('#message .metadata dd.from').text(message.sender);
            $('#message .metadata dd.to').text((message.recipients || []).join(', '));
            $('#message .metadata dd.subject').text(message.subject);
            $('#message .views .tab.format').each(function(i, el) {
              var $el, format;
              $el = $(el);
              format = $el.attr('data-message-format');
              if ($.inArray(format, message.formats) >= 0) {
                $el.find('a').attr('href', "/messages/" + id + "." + format);
                return $el.show();
              } else {
                return $el.hide();
              }
            });
            if ($("#message .views .tab.selected:not(:visible)").length) {
              $("#message .views .tab.selected").removeClass("selected");
              $("#message .views .tab:visible:first").addClass("selected");
            }
            if (message.attachments.length) {
              $ul = $('<ul/>').appendTo($('#message .metadata dd.attachments').empty());
              $.each(message.attachments, function(i, attachment) {
                return $ul.append($('<li>').append($('<a>').attr('href', attachment['href']).addClass(attachment['type'].split('/', 1)[0]).addClass(attachment['type'].replace('/', '-')).text(attachment['filename'])));
              });
              $('#message .metadata .attachments').show();
            } else {
              $('#message .metadata .attachments').hide();
            }
            $('#message .views .download a').attr('href', "/messages/" + id + ".eml");
            if ($('#message .views .tab.analysis.selected').length) {
              return _this.loadMessageAnalysis();
            } else {
              return _this.loadMessageBody();
            }
          };
        })(this));
      }
    };

    MailCatcher.prototype.loadMessageBody = function(id, format) {
      var app;
      id || (id = this.selectedMessage());
      format || (format = $('#message .views .tab.format.selected').attr('data-message-format'));
      format || (format = 'html');
      $("#message .views .tab[data-message-format=\"" + format + "\"]:not(.selected)").addClass('selected');
      $("#message .views .tab:not([data-message-format=\"" + format + "\"]).selected").removeClass('selected');
      if (id != null) {
        $('#message iframe').attr("src", "/messages/" + id + "." + format);
        return app = this;
      }
    };

    MailCatcher.prototype.decorateMessageBody = function() {
      var body, format, message_iframe, text;
      format = $('#message .views .tab.format.selected').attr('data-message-format');
      switch (format) {
        case 'html':
          body = $('#message iframe').contents().find('body');
          return $("a", body).attr("target", "_blank");
        case 'plain':
          message_iframe = $('#message iframe').contents();
          text = message_iframe.text();
          text = text.replace(/((http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&amp;:\/~\+#]*[\w\-\@?^=%&amp;\/~\+#])?)/g, '<a href="$1" target="_blank">$1</a>');
          text = text.replace(/\n/g, '<br/>');
          return message_iframe.find('html').html('<html><body>' + text + '</html></body>');
      }
    };

    MailCatcher.prototype.loadMessageAnalysis = function(id) {
      var $form, $iframe;
      id || (id = this.selectedMessage());
      $("#message .views .analysis.tab:not(.selected)").addClass('selected');
      $("#message .views :not(.analysis).tab.selected").removeClass('selected');
      if (id != null) {
        $iframe = $('#message iframe').contents().children().html("<html>\n<head>\n<title>Analysis</title>\n" + ($('link[rel="stylesheet"]')[0].outerHTML) + "\n</head>\n<body class=\"iframe\">\n<h1>Analyse your email with Fractal</h1>\n<p><a href=\"http://getfractal.com/\" target=\"_blank\">Fractal</a> is a really neat service that applies common email design and development knowledge from <a href=\"http://www.email-standards.org/\" target=\"_blank\">Email Standards Project</a> to your HTML email and tells you what you've done wrong or what you should do instead.</p>\n<p>Please note that this <strong>sends your email to the Fractal service</strong> for analysis. Read their <a href=\"https://www.getfractal.com/page/terms\" target=\"_blank\">terms of service</a> if you're paranoid.</p>\n<form>\n<input type=\"submit\" value=\"Analyse\" /><span class=\"loading\" style=\"color: #999; display: none\">Analysing&hellip;</span>\n</form>\n</body>\n</html>");
        return $form = $iframe.find('form').submit(function(e) {
          e.preventDefault();
          $(this).find('input[type="submit"]').attr('disabled', 'disabled').end().find('.loading').show();
          return $('#message iframe').contents().find('body').xslt("/messages/" + id + "/analysis.xml", "/stylesheets/analysis.xsl");
        });
      }
    };

    MailCatcher.prototype.refresh = function() {
      return $.getJSON('/messages', (function(_this) {
        return function(messages) {
          return $.each(messages, function(i, message) {
            if (!_this.haveMessage(message)) {
              if (message.recipients != null) {
                message.recipients = JSON.parse(message.recipients);
              }
              return _this.addMessage(message);
            }
          });
        };
      })(this));
    };

    MailCatcher.prototype.subscribe = function() {
      if (typeof WebSocket !== "undefined" && WebSocket !== null) {
        // Cam: Disable websocket, JRuby version server don't enable this feature
        //return this.subscribeWebSocket();
      } else {
        return this.subscribePoll();
      }
    };

    MailCatcher.prototype.subscribeWebSocket = function() {
      var secure;
      secure = window.location.scheme === 'https';
      this.websocket = new WebSocket("" + (secure ? 'wss' : 'ws') + "://" + window.location.host + "/messages");
      return this.websocket.onmessage = (function(_this) {
        return function(event) {
          return _this.addMessage($.parseJSON(event.data));
        };
      })(this);
    };

    MailCatcher.prototype.subscribePoll = function() {
      if (this.refreshInterval == null) {
        return this.refreshInterval = setInterval(((function(_this) {
          return function() {
            return _this.refresh();
          };
        })(this)), 1000);
      }
    };

    MailCatcher.prototype.resizeToSavedKey = 'mailcatcherSeparatorHeight';

    MailCatcher.prototype.resizeTo = function(height) {
      var _ref;
      $('#messages').css({
        height: height - $('#messages').offset().top
      });
      return (_ref = window.localStorage) != null ? _ref.setItem(this.resizeToSavedKey, height) : void 0;
    };

    MailCatcher.prototype.resizeToSaved = function() {
      var height, _ref;
      height = parseInt((_ref = window.localStorage) != null ? _ref.getItem(this.resizeToSavedKey) : void 0);
      if (!isNaN(height)) {
        return this.resizeTo(height);
      }
    };

    return MailCatcher;

  })();

  $(function() {
    return window.MailCatcher = new MailCatcher;
  });

}).call(this);
