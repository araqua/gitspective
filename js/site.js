(function() {
  var Event, Repo, TimeStamps, User, hasMorePages, parseISODate,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  hasMorePages = function(meta) {
    return (meta["Link"] || []).filter(function(link) {
      if (link[1]["rel"] === "next") {
        return true;
      }
    }).length > 0;
  };

  parseISODate = function(raw) {
    return Date.parse(raw.slice(0, raw.length - 1));
  };

  TimeStamps = {
    created_at_date: function() {
      return parseISODate(this.created_at);
    },
    created_at_string: function() {
      return this.created_at_date().toString('MMMM d, yyyy');
    }
  };

  User = (function(_super) {

    __extends(User, _super);

    User.name = 'User';

    function User() {
      return User.__super__.constructor.apply(this, arguments);
    }

    User.configure("User", "type", "url", "public_gists", "followers", "gravatar_id", "hireable", "avatar_url", "public_repos", "bio", "login", "email", "html_url", "created_at", "company", "blog", "location", "following", "name");

    User.include(TimeStamps);

    return User;

  })(Spine.Model);

  Repo = (function(_super) {

    __extends(Repo, _super);

    Repo.name = 'Repo';

    function Repo() {
      return Repo.__super__.constructor.apply(this, arguments);
    }

    Repo.configure("Repo", "updated_at", "clone_url", "has_downloads", "watchers", "homepage", "git_url", "mirror_url", "fork", "ssh_url", "url", "has_wiki", "has_issues", "forks", "language", "size", "html_url", "private", "created_at", "name", "open_issues", "description", "svn_url", "pushed_at");

    Repo.include(TimeStamps);

    Repo.fetch = function(user) {
      var fetchHelper,
        _this = this;
      this.deleteAll();
      fetchHelper = function(page) {
        console.log("Fetching repo page " + page);
        return $.getJSON("https://api.github.com/users/" + user.login + "/repos?page=" + page + "&callback=?", function(response) {
          $.each(response.data, function(i, repoData) {
            return Repo.create(repoData);
          });
          if (hasMorePages(response.meta)) {
            return fetchHelper(page + 1);
          }
        });
      };
      return fetchHelper(1);
    };

    return Repo;

  })(Spine.Model);

  Event = (function(_super) {

    __extends(Event, _super);

    Event.name = 'Event';

    function Event() {
      return Event.__super__.constructor.apply(this, arguments);
    }

    Event.configure("Event", "type", "public", "repo", "created_at", "actor", "id", "payload");

    Event.include(TimeStamps);

    Event.fetchPages = function(user, callback, page) {
      var fetchHelper, max,
        _this = this;
      if (page == null) {
        page = 1;
      }
      max = page + 2;
      fetchHelper = function(currentPage, events, callback) {
        var url;
        console.log("Fetching event page " + currentPage);
        url = "https://api.github.com/users/" + user.login + "/events?page=" + currentPage + "&callback=?";
        return $.getJSON(url, function(response) {
          $.each(response.data, function(i, eventData) {
            return events.push(new Event(eventData));
          });
          if (currentPage < max && hasMorePages(response.meta)) {
            return fetchHelper(currentPage + 1, events, callback);
          } else {
            return callback([currentPage + 1, events]);
          }
        });
      };
      return fetchHelper(page, [], callback);
    };

    Event.prototype.viewType = function() {
      switch (this.type) {
        case "CreateEvent":
          if (this.payload.ref_type === "repository") {
            return "repo";
          } else {
            return "item";
          }
          break;
        default:
          return "item";
      }
    };

    Event.prototype.viewInfo = function() {
      var view;
      view = this.viewType();
      switch (view) {
        case "item":
          return [
            view, {
              id: this.id,
              title: this.type
            }
          ];
        case "repo":
          return [
            view, {
              id: this.id,
              title: this.repo.name
            }
          ];
      }
    };

    return Event;

  })(Spine.Model);

  window.Github = {
    User: User,
    Repo: Repo,
    Event: Event
  };

  window.App = (function(_super) {

    __extends(App, _super);

    App.name = 'App';

    App.prototype.elements = {
      "#messages": "messages",
      "#content": "content",
      "#timeline": "timeline",
      "#joined": "joined"
    };

    App.prototype.events = {
      "submit form": "search"
    };

    function App() {
      this.search = __bind(this.search, this);

      this.fetchUser = __bind(this.fetchUser, this);

      this.navigateTo = __bind(this.navigateTo, this);

      this.renderUser = __bind(this.renderUser, this);

      var _this = this;
      App.__super__.constructor.apply(this, arguments);
      this.routes({
        "/": function() {
          _this.user = null;
          return _this.content.html(_this.view("index"));
        },
        "/timeline/:user": function(params) {
          if (_this.user) {
            return _this.renderUser(_this.user);
          } else {
            return _this.fetchUser(params.user, _this.renderUser);
          }
        }
      });
      Spine.Route.setup();
    }

    App.prototype.renderUser = function(user) {
      var _this = this;
      Repo.fetch(user);
      this.content.html(this.view("show", {
        user: user
      }));
      this.content.find("#timeline").append(this.view("joined", {
        user: user
      }));
      this.refreshElements();
      this.timeline.masonry();
      this.page = 1;
      return Event.fetchPages(user, function(_arg) {
        var events, page, sorted;
        page = _arg[0], events = _arg[1];
        _this.page = page;
        events.forEach(function(event) {
          return event.save();
        });
        sorted = events.sort(function(a, b) {
          return b.created_at_date() - a.created_at_date();
        });
        return _this.appendEvents(sorted);
      });
    };

    App.prototype.appendEvents = function(events) {
      var _this = this;
      events.forEach(function(event) {
        var viewArgs, viewType, _ref;
        _ref = event.viewInfo(), viewType = _ref[0], viewArgs = _ref[1];
        return _this.joined.before(_this.view(viewType, viewArgs));
      });
      return this.refreshTimeline();
    };

    App.prototype.placeArrows = function() {
      var min_max;
      min_max = $.unique(this.timeline.find(".item").map(function(e) {
        return parseInt($(this).css("left"));
      })).sort();
      return this.timeline.find(".item").each(function() {
        var $e;
        $e = $(this);
        if (parseInt($e.css("left")) === min_max[0]) {
          return $e.attr("data-align", "l");
        } else {
          return $e.attr("data-align", "r");
        }
      });
    };

    App.prototype.refreshTimeline = function() {
      this.timeline.masonry("reload");
      return this.placeArrows();
    };

    App.prototype.navigateTo = function(e) {
      e.preventDefault();
      return this.navigate($(e.target).attr("href"));
    };

    App.prototype.fetchUser = function(username, callback) {
      var _this = this;
      return $.getJSON("https://api.github.com/users/" + username + "?callback=?", function(response) {
        if (response.meta.status === 404) {
          return _this.messages.html(_this.view("error", {
            message: "User not found"
          }));
        } else if (response.meta["X-RateLimit-Remaining"] === "0") {
          return _this.messages.html(_this.view("error", {
            message: "Your IP has hit your Github API limit. Please wait for it to reset"
          }));
        } else {
          _this.messages.html("");
          _this.user = new User(response.data);
          return callback(_this.user);
        }
      }).error(function() {
        return _this.messages.html(_this.view("error", {
          message: "Something went wrong with the API"
        }));
      });
    };

    App.prototype.search = function(e) {
      var $form, username,
        _this = this;
      e.preventDefault();
      $form = $(e.target);
      username = $form.find("input").val();
      if ($.isEmptyObject(username)) {
        return this.messages.html(this.view("error", {
          message: "Username is required"
        }));
      } else {
        return this.fetchUser(username, function() {
          return _this.navigate("/timeline/" + username);
        });
      }
    };

    return App;

  })(Spine.Controller);

  $(function() {
    return window.app = new App({
      el: $(".container")
    });
  });

}).call(this);
