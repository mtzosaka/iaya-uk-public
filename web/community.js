(function () {
  'use strict';

  var state = { route: 'community', revision: 0, session: null, config: null };
  var googleScriptPromise = null;

  function t(en, ar) { return document.documentElement.lang === 'ar' ? ar : en; }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }
  function link(text, route, primary) {
    var a = el('a', 'btn ' + (primary ? 'btn-primary' : 'btn-secondary'), text);
    a.href = '#/' + route;
    return a;
  }
  function button(text, handler, primary) {
    var b = el('button', 'btn ' + (primary ? 'btn-primary' : 'btn-secondary'), text);
    b.type = 'button';
    if (handler) b.addEventListener('click', handler);
    return b;
  }
  function notice(text, error) {
    var n = el('div', 'notice' + (error ? ' notice-error' : ''), text);
    n.setAttribute('role', error ? 'alert' : 'status');
    n.setAttribute('aria-live', error ? 'assertive' : 'polite');
    return n;
  }
  function current(revision) { return state.revision === revision; }
  function navigate(route) {
    if (window.location.hash === '#/' + route) render(route);
    else window.location.hash = '#/' + route;
  }
  function statusText(status) {
    if (status === 'approved') return t('Approved member', 'عضو معتمد');
    if (status === 'pending') return t('Awaiting approval', 'بانتظار الموافقة');
    if (status === 'rejected') return t('Application not approved', 'لم تتم الموافقة على الطلب');
    return t('Membership application', 'طلب العضوية');
  }
  function badge(status) {
    var knownStatus = ['pending', 'approved', 'rejected'].indexOf(status) >= 0 ? status : 'unknown';
    return el('span', 'status-badge status-' + knownStatus, statusText(knownStatus));
  }
  function heading(parent, kicker, title, description) {
    var h = el('div', 'page-heading');
    var titleNode = el('h1', '', title);
    titleNode.tabIndex = -1;
    add(h, el('p', 'kicker', kicker), titleNode, el('p', '', description));
    parent.appendChild(h);
    return titleNode;
  }

  function ApiError(message, status, code) {
    this.name = 'ApiError'; this.message = message; this.status = status; this.code = code;
    this.stack = (new Error(message)).stack;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  async function api(path, options) {
    options = options || {};
    if (window.location.protocol === 'file:') {
      throw new ApiError(t('Membership requires the hosted website and its secure community service. Open the live site to sign in or apply.', 'تتطلب العضوية الموقع المستضاف وخدمة المجتمع الآمنة. افتح الموقع المباشر لتسجيل الدخول أو تقديم الطلب.'), 0, 'service_unavailable');
    }
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 18000);
    var headers = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.csrf && state.session && state.session.csrf_token) {
      headers['X-CSRF-Token'] = state.session.csrf_token;
    }
    try {
      var response = await fetch(path, {
        method: options.method || 'GET', headers: headers, credentials: 'same-origin',
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal, cache: 'no-store'
      });
      var type = response.headers.get('content-type') || '';
      if (type.indexOf('application/json') < 0) {
        throw new ApiError(t('The community service is unavailable on this preview. Open the hosted website and try again.', 'خدمة المجتمع غير متاحة في هذه المعاينة. افتح الموقع المستضاف وحاول مرة أخرى.'), response.status, 'service_unavailable');
      }
      var data = await response.json();
      if (!response.ok) {
        var fallback = t('The request could not be completed. Please try again.', 'تعذر إكمال الطلب. يرجى المحاولة مرة أخرى.');
        var serverMessage = typeof data.error === 'string' ? data.error : typeof data.message === 'string' ? data.message : fallback;
        throw new ApiError(serverMessage, response.status, data.code || 'request_failed');
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new ApiError(t('The service took too long to respond. Please try again.', 'استغرقت الخدمة وقتاً طويلاً للرد. يرجى المحاولة مرة أخرى.'), 0, 'timeout');
      if (error instanceof ApiError) throw error;
      throw new ApiError(t('We could not reach the community service. Check your connection and try again.', 'تعذر الاتصال بخدمة المجتمع. تحقق من اتصالك وحاول مرة أخرى.'), 0, 'network_error');
    } finally { clearTimeout(timeout); }
  }

  function errorText(error) {
    if (error.status === 401) return t('Your session has expired. Please sign in again.', 'انتهت جلسة الدخول. يرجى تسجيل الدخول مرة أخرى.');
    if (error.status === 403) return t('Your account does not have permission for this action.', 'لا يملك حسابك الصلاحية لتنفيذ هذا الإجراء.');
    if (error.status === 409) return t('This application has changed. Refresh the list before reviewing it again.', 'تم تغيير هذا الطلب. حدّث القائمة قبل مراجعته مرة أخرى.');
    if (document.documentElement.lang === 'ar' && error.status >= 400 && error.code !== 'service_unavailable') {
      if (error.status === 429) return 'طلبات كثيرة في وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.';
      return 'تعذر إكمال الطلب. تحقق من البيانات وحاول مرة أخرى.';
    }
    return error.message;
  }

  function loadGoogle() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    if (googleScriptPromise) return googleScriptPromise;
    googleScriptPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timer = setTimeout(function () { reject(new Error('Google sign-in timed out')); }, 15000);
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true; script.defer = true;
      script.addEventListener('load', function () {
        clearTimeout(timer);
        if (window.google && window.google.accounts && window.google.accounts.id) resolve();
        else reject(new Error('Google sign-in unavailable'));
      }, { once: true });
      script.addEventListener('error', function () { clearTimeout(timer); reject(new Error('Google sign-in blocked')); }, { once: true });
      document.head.appendChild(script);
    }).catch(function (error) { googleScriptPromise = null; throw error; });
    return googleScriptPromise;
  }

  function googlePanel(parent, revision, joining) {
    var panel = el('section', 'auth-panel');
    add(panel,
      el('p', 'kicker', t('A trusted community', 'مجتمع موثوق')),
      el('h2', '', joining ? t('Begin your membership', 'ابدأ طلب عضويتك') : t('Welcome back', 'مرحباً بعودتك')),
      el('p', '', t('Use your Google account to sign in securely. New members complete an application for association approval.', 'استخدم حساب Google للدخول بأمان. يُكمل الأعضاء الجدد طلباً لمراجعته والموافقة عليه من الجمعية.'))
    );
    var feedback = notice('');
    var googleHost = el('div', 'google-signin');
    googleHost.setAttribute('aria-label', t('Continue with Google', 'المتابعة باستخدام Google'));
    add(panel, googleHost, feedback);
    if (!state.config || !state.config.configured || !state.config.google_client_id) {
      var unavailable = button(t('Google sign-in is being configured', 'تسجيل الدخول عبر Google قيد الإعداد'), null, true);
      unavailable.disabled = true;
      googleHost.appendChild(unavailable);
      feedback.textContent = t('Membership applications will open when secure sign-in is available. Please use the contact page for enquiries in the meantime.', 'ستتاح طلبات العضوية عند تفعيل تسجيل الدخول الآمن. يمكنك استخدام صفحة التواصل للاستفسار في الوقت الحالي.');
      panel.appendChild(link(t('Contact the association', 'تواصل مع الجمعية'), 'contact', false));
      parent.appendChild(panel);
      return;
    }
    feedback.textContent = t('Loading secure Google sign-in…', 'جارٍ تحميل تسجيل الدخول الآمن عبر Google…');
    if (state.config.admin_review_enabled === false) panel.appendChild(notice(t('Membership review is not available yet. Approval will begin once the association has configured its authorised reviewers.', 'مراجعة العضوية غير متاحة بعد. ستبدأ الموافقة على الطلبات بعد إعداد حسابات مسؤولي المراجعة المخوّلين من الجمعية.')));
    parent.appendChild(panel);
    (async function () {
      try {
        var results = await Promise.all([api('/api/auth/nonce'), loadGoogle()]);
        if (!current(revision) || !googleHost.isConnected) return;
        var nonce = results[0].nonce;
        if (!nonce) throw new Error('Missing sign-in nonce');
        var signingIn = false;
        window.google.accounts.id.initialize({
          client_id: state.config.google_client_id, nonce: nonce, auto_select: false,
          ux_mode: 'popup', context: joining ? 'signup' : 'signin',
          callback: async function (response) {
            if (!current(revision) || signingIn || !response.credential) return;
            signingIn = true;
            feedback.textContent = t('Signing you in…', 'جارٍ تسجيل دخولك…');
            googleHost.setAttribute('aria-busy', 'true');
            try {
              await api('/api/auth/google', { method: 'POST', body: { credential: response.credential, nonce: nonce } });
              var session = await api('/api/session');
              if (!current(revision)) return;
              state.session = session;
              var destination = state.route === 'admin' && session.user && session.user.is_admin ? 'admin' : session.membership && session.membership.status === 'approved' ? 'community' : 'join';
              navigate(destination);
            } catch (error) {
              if (current(revision)) {
                feedback.textContent = errorText(error);
                feedback.setAttribute('role', 'alert');
                googleHost.replaceChildren();
                panel.appendChild(button(t('Try sign-in again', 'حاول تسجيل الدخول مجدداً'), function () { render(state.route); }, false));
              }
            } finally { signingIn = false; googleHost.removeAttribute('aria-busy'); }
          }
        });
        window.google.accounts.id.renderButton(googleHost, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
          text: 'continue_with', locale: document.documentElement.lang === 'ar' ? 'ar' : 'en',
          width: Math.min(320, Math.max(200, googleHost.clientWidth || 320))
        });
        feedback.textContent = t('Signing in identifies your account. Membership access begins after approval.', 'يؤكد تسجيل الدخول هوية حسابك. تتاح مساحة الأعضاء بعد الموافقة على العضوية.');
      } catch (error) {
        if (!current(revision)) return;
        feedback.textContent = t('Google sign-in could not load. Check your connection, allow the Google sign-in window, then try again.', 'تعذر تحميل تسجيل الدخول عبر Google. تحقق من اتصالك واسمح بفتح نافذة Google ثم حاول مرة أخرى.');
        feedback.setAttribute('role', 'alert');
        panel.appendChild(button(t('Try again', 'حاول مجدداً'), function () { render(state.route); }, false));
      }
    }());
  }

  function accountPanel(parent, revision) {
    var user = state.session.user || {};
    var panel = el('section', 'auth-panel account-panel');
    add(panel, el('p', 'kicker', t('Your account', 'حسابك')), el('h2', '', user.name || user.email || t('Member account', 'حساب العضو')));
    if (user.email) panel.appendChild(el('p', 'account-email', user.email));
    if (state.session.membership) panel.appendChild(badge(state.session.membership.status));
    var actions = el('div', 'account-actions');
    if (user.is_admin) actions.appendChild(link(t('Review applications', 'مراجعة الطلبات'), 'admin', false));
    var output = notice('');
    var signOut = button(t('Sign out', 'تسجيل الخروج'), async function () {
      signOut.disabled = true;
      output.textContent = t('Signing out…', 'جارٍ تسجيل الخروج…');
      try {
        await api('/api/auth/logout', { method: 'POST', csrf: true, body: {} });
        if (!current(revision)) return;
        state.session = null; navigate('signin');
      } catch (error) {
        if (current(revision)) { signOut.disabled = false; output.textContent = errorText(error); output.setAttribute('role', 'alert'); }
      }
    }, false);
    add(actions, signOut); add(panel, actions, output); parent.appendChild(panel);
    return panel;
  }

  function membershipStatus(parent, membership) {
    var panel = el('section', 'auth-panel');
    add(panel, badge(membership.status), el('h2', '', membership.status === 'pending' ? t('Your application is with the association', 'طلبك قيد المراجعة لدى الجمعية') : t('An update on your application', 'تحديث بشأن طلبك')));
    if (membership.status === 'pending') panel.appendChild(el('p', '', t('Your application has been received. An authorised association reviewer will decide on membership. Check this page for your status.', 'تم استلام طلبك. سيقوم مسؤول مخوّل من الجمعية بمراجعة العضوية. يمكنك متابعة حالة الطلب من هذه الصفحة.')));
    else panel.appendChild(el('p', '', t('Your application has not been approved. You can contact the association for more information or submit a revised application.', 'لم تتم الموافقة على طلبك. يمكنك التواصل مع الجمعية للاستفسار أو تقديم طلب محدّث.')));
    if (membership.review_note) panel.appendChild(el('p', 'review-note', membership.review_note));
    if (membership.status === 'pending' && state.config.admin_review_enabled === false) panel.appendChild(notice(t('Review will begin once the association has configured its authorised reviewers.', 'ستبدأ المراجعة بعد إعداد حسابات مسؤولي المراجعة المخوّلين من الجمعية.')));
    var details = el('dl', 'membership-details');
    [[t('Name', 'الاسم'), membership.full_name], [t('Institution', 'المؤسسة'), membership.university], [t('Field', 'التخصص'), membership.field]].forEach(function (item) {
      if (item[1]) add(details, el('dt', '', item[0]), el('dd', '', item[1]));
    });
    add(panel, details, link(t('Contact the association', 'تواصل مع الجمعية'), 'contact', false));
    parent.appendChild(panel);
  }

  function field(form, name, label, options) {
    options = options || {};
    var wrapper = el('div', 'field' + (options.wide ? ' field-wide' : ''));
    var id = 'membership-' + name;
    var labelNode = el('label', '', label + (options.required ? ' *' : ''));
    labelNode.htmlFor = id;
    var input = el(options.multiline ? 'textarea' : 'input');
    input.id = id; input.name = name; input.required = Boolean(options.required);
    input.maxLength = options.maxLength || 200;
    if (options.minLength) input.minLength = options.minLength;
    if (!options.multiline) input.type = 'text';
    if (options.autocomplete) input.autocomplete = options.autocomplete;
    if (options.multiline) input.rows = 5;
    if (options.value) input.value = options.value;
    add(wrapper, labelNode, input);
    if (options.help) {
      var help = el('p', 'field-help', options.help); help.id = id + '-help';
      input.setAttribute('aria-describedby', help.id); wrapper.appendChild(help);
    }
    form.appendChild(wrapper);
    return input;
  }

  function membershipForm(parent, revision, existing, draft) {
    var panel = el('section', 'auth-panel');
    add(panel, el('p', 'kicker', t('Membership application', 'طلب العضوية')), el('h2', '', existing ? t('Update your application', 'حدّث طلبك') : t('Tell us a little about yourself', 'عرّفنا بنفسك')),
      el('p', '', t('Membership is reviewed by the association. Fields marked * are required.', 'تخضع العضوية لمراجعة الجمعية. الحقول المميزة بعلامة * مطلوبة.')));
    if (state.config.admin_review_enabled === false) panel.appendChild(notice(t('You may submit an application now. Approval will begin once the association has configured its authorised reviewers.', 'يمكنك إرسال طلبك الآن. ستبدأ الموافقة على الطلبات بعد إعداد حسابات مسؤولي المراجعة المخوّلين من الجمعية.')));
    var form = el('form', 'form-grid');
    var fullName = field(form, 'full_name', t('Full name', 'الاسم الكامل'), { required: true, minLength: 2, maxLength: 120, autocomplete: 'name', value: draft ? draft.full_name : existing ? existing.full_name : (state.session.user || {}).name });
    var university = field(form, 'university', t('University or institution (optional)', 'الجامعة أو المؤسسة (اختياري)'), { maxLength: 180, autocomplete: 'organization', value: draft ? draft.university : existing && existing.university });
    var area = field(form, 'field', t('Academic or professional field (optional)', 'التخصص الأكاديمي أو المهني (اختياري)'), { maxLength: 180, value: draft ? draft.field : existing && existing.field });
    var message = field(form, 'message', t('Your connection to the community', 'صلتك بالمجتمع'), { multiline: true, wide: true, maxLength: 2000, value: draft ? draft.message : existing && existing.message, help: t('Share your interests and how you would like to contribute. Maximum 2,000 characters. Please avoid sensitive personal information.', 'شارك اهتماماتك وكيف ترغب بالمساهمة. الحد الأقصى ٢٠٠٠ حرف. يرجى تجنّب المعلومات الشخصية الحساسة.') });
    var consentWrap = el('div', 'field field-wide consent-field');
    var consentLabel = el('label');
    var consent = el('input'); consent.id = 'membership-consent'; consent.type = 'checkbox'; consent.name = 'consent'; consent.required = true;
    consent.checked = Boolean(draft && draft.consent);
    add(consentLabel, consent, el('span', '', t('I agree that the association may use my account and application details to review and manage my membership.', 'أوافق على استخدام الجمعية لبيانات حسابي وطلبي لمراجعة عضويتي وإدارتها.')));
    add(consentWrap, consentLabel, el('p', 'field-help', t('Application details are visible to authorised reviewers. Google verifies your identity; approval is a separate step.', 'بيانات الطلب متاحة لمسؤولي المراجعة المخوّلين. يتحقق Google من هويتك، بينما الموافقة على العضوية خطوة مستقلة.')));
    var feedback = notice(''); feedback.classList.add('field-wide');
    var submit = el('button', 'btn btn-primary', t('Submit for approval', 'إرسال للموافقة')); submit.type = 'submit';
    add(form, consentWrap, feedback, submit);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      [fullName, university, area].forEach(function (input) { input.value = input.value.trim(); });
      if (!form.reportValidity()) return;
      submit.disabled = true; form.setAttribute('aria-busy', 'true');
      feedback.setAttribute('role', 'status'); feedback.textContent = t('Submitting your application…', 'جارٍ إرسال طلبك…');
      try {
        var result = await api('/api/membership', { method: 'POST', csrf: true, body: {
          full_name: fullName.value, university: university.value, field: area.value,
          message: message.value.trim(), consent: consent.checked
        } });
        if (!current(revision)) return;
        state.session.membership = result.membership;
        render('join');
      } catch (error) {
        if (current(revision)) { feedback.textContent = errorText(error); feedback.setAttribute('role', 'alert'); submit.disabled = false; form.removeAttribute('aria-busy'); }
      }
    });
    add(panel, form); parent.appendChild(panel);
  }

  function publicCommunity(parent, revision, route) {
    var layout = parent;
    var intro = el('section', 'auth-panel');
    add(intro, el('p', 'kicker', t('Connected by purpose', 'يجمعنا هدف')),
      el('h2', '', t('Knowledge, connection and shared opportunity', 'معرفة وتواصل وفرص مشتركة')),
      el('p', '', t('Join the IAYA community to stay connected with the association and access resources for approved members.', 'انضم إلى مجتمع إيايا للتواصل مع الجمعية والوصول إلى الموارد المتاحة للأعضاء المعتمدين.')));
    var steps = el('ol', 'membership-steps');
    [t('Sign in with Google.', 'سجّل الدخول باستخدام Google.'), t('Tell us about your academic or professional background.', 'عرّفنا بخلفيتك الأكاديمية أو المهنية.'), t('The association reviews your application.', 'تراجع الجمعية طلبك.'), t('Approved members can enter the community space.', 'يمكن للأعضاء المعتمدين دخول مساحة المجتمع.')].forEach(function (text) { steps.appendChild(el('li', '', text)); });
    intro.appendChild(steps); layout.appendChild(intro);
    googlePanel(layout, revision, route === 'join');
  }

  function safeResourceUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      var url = new URL(value, window.location.origin);
      if (url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === window.location.origin)) return url.href;
    } catch (_) { /* Invalid resource URLs are not linked. */ }
    return null;
  }

  async function membersArea(parent, revision) {
    var panel = el('section', 'auth-panel');
    var output = notice(t('Loading member resources…', 'جارٍ تحميل موارد الأعضاء…'));
    add(panel, el('p', 'kicker', t('Members area', 'مساحة الأعضاء')), el('h2', '', t('Welcome to your community', 'مرحباً بك في مجتمعك')), output);
    parent.appendChild(panel);
    try {
      var data = await api('/api/community');
      if (!current(revision)) return;
      var resources = Array.isArray(data.resources) ? data.resources : [];
      if (!resources.length) {
        output.textContent = t('Your membership is active. Association resources will appear here when they are published.', 'عضويتك مفعّلة. ستظهر موارد الجمعية هنا عند نشرها.');
        add(panel, link(t('Explore association activities', 'استكشف أنشطة الجمعية'), 'activities', false), link(t('Contact the association', 'تواصل مع الجمعية'), 'contact', false));
        return;
      }
      output.textContent = t('Resources shared by the association for approved members.', 'موارد تشاركها الجمعية مع الأعضاء المعتمدين.');
      var grid = el('div', 'member-grid');
      resources.forEach(function (resource) {
        var item = el('article', 'member-item');
        add(item, el('h3', '', resource.title || t('Member resource', 'مورد للأعضاء')), el('p', '', resource.description || ''));
        var url = safeResourceUrl(resource.url);
        if (url) {
          var a = el('a', 'btn btn-secondary', t('Open resource', 'افتح المورد'));
          a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; item.appendChild(a);
        }
        grid.appendChild(item);
      });
      panel.appendChild(grid);
    } catch (error) {
      if (!current(revision)) return;
      output.textContent = errorText(error); output.setAttribute('role', 'alert');
      panel.appendChild(button(t('Refresh membership', 'حدّث حالة العضوية'), function () { render('community'); }, false));
    }
  }

  function applicationRow(application, revision, onReviewed, drafts) {
    var row = el('article', 'application-row');
    var content = el('div', 'application-content');
    add(content, el('h3', '', application.full_name || t('Membership applicant', 'متقدم للعضوية')), badge(application.status));
    if (application.email) content.appendChild(el('p', 'application-email', application.email));
    var details = [application.university, application.field].filter(Boolean);
    if (details.length) content.appendChild(el('p', '', details.join(' · ')));
    if (application.message) content.appendChild(el('p', 'application-message', application.message));
    if (application.created_at) {
      var date = new Date(application.created_at);
      if (!isNaN(date.getTime())) content.appendChild(el('p', 'field-help', t('Applied: ', 'تاريخ الطلب: ') + date.toLocaleDateString(document.documentElement.lang === 'ar' ? 'ar' : 'en-GB')));
    }
    row.appendChild(content);
    if (application.status !== 'pending') return row;
    var actions = el('div', 'application-actions');
    var noteLabel = el('label', 'field-help', t('Review note (optional; visible to applicant)', 'ملاحظة المراجعة (اختيارية؛ تظهر للمتقدم)'));
    var note = el('textarea'); note.rows = 2; note.maxLength = 1000;
    note.setAttribute('data-review-id', application.id);
    if (drafts && typeof drafts[application.id] === 'string') note.value = drafts[application.id];
    note.setAttribute('aria-label', t('Review note for ', 'ملاحظة المراجعة للمتقدم ') + (application.full_name || application.id));
    noteLabel.appendChild(note);
    var feedback = notice('');
    var approve, reject;
    async function review(status) {
      approve.disabled = true; reject.disabled = true;
      feedback.setAttribute('role', 'status'); feedback.textContent = t('Saving review…', 'جارٍ حفظ المراجعة…');
      try {
        await api('/api/admin/applications/' + encodeURIComponent(application.id), {
          method: 'PATCH', csrf: true, body: { status: status, version: application.version, note: note.value.trim() }
        });
        if (!current(revision)) return;
        feedback.textContent = t('Review saved.', 'تم حفظ المراجعة.');
        onReviewed();
      } catch (error) {
        if (!current(revision)) return;
        feedback.textContent = errorText(error); feedback.setAttribute('role', 'alert');
        if (error.status !== 409) { approve.disabled = false; reject.disabled = false; }
      }
    }
    approve = button(t('Approve', 'موافقة'), function () { review('approved'); }, true);
    reject = button(t('Decline', 'رفض'), function () { review('rejected'); }, false);
    add(actions, noteLabel, approve, reject, feedback); row.appendChild(actions);
    return row;
  }

  async function adminArea(parent, revision, draft) {
    if (!state.session.authenticated) {
      parent.appendChild(notice(t('Sign in with an authorised association administrator account to review applications.', 'سجّل الدخول بحساب مسؤول مخوّل من الجمعية لمراجعة الطلبات.')));
      googlePanel(parent, revision, false); return;
    }
    accountPanel(parent, revision);
    if (!state.session.user || !state.session.user.is_admin) {
      add(parent, notice(t('This page is for authorised association administrators. Your account does not have administrator access.', 'هذه الصفحة مخصصة لمسؤولي الجمعية المخوّلين. لا يملك حسابك صلاحية المسؤول.'), true), link(t('Return to the community', 'العودة إلى المجتمع'), 'community', false));
      return;
    }
    var panel = el('section', 'auth-panel admin-panel');
    var toolbar = el('div', 'admin-toolbar');
    var label = el('label', '', t('Application status', 'حالة الطلب'));
    var filter = el('select'); filter.id = 'application-status-filter'; label.htmlFor = filter.id;
    [['pending', t('Awaiting review', 'بانتظار المراجعة')], ['approved', t('Approved', 'معتمدة')], ['rejected', t('Declined', 'مرفوضة')], ['all', t('All applications', 'جميع الطلبات')]].forEach(function (item) {
      var option = el('option', '', item[1]); option.value = item[0]; filter.appendChild(option);
    });
    if (draft && ['pending', 'approved', 'rejected', 'all'].indexOf(draft.filter) >= 0) filter.value = draft.filter;
    var output = notice('');
    var totals = el('p', 'field-help');
    var list = el('div', 'application-list');
    var more = button(t('Load more applications', 'تحميل مزيد من الطلبات'), function () { loadQueue(true); }, false); more.hidden = true;
    var request = 0, nextCursor = null, rows = [], isLoading = false;
    var refresh = button(t('Refresh', 'تحديث'), function () { loadQueue(false); }, false);
    add(toolbar, label, filter, refresh); add(panel, toolbar, totals, output, list, more); parent.appendChild(panel);

    async function loadQueue(append) {
      if (isLoading && append) return;
      var localRequest = ++request;
      isLoading = true; filter.disabled = true; refresh.disabled = true; more.disabled = true;
      list.setAttribute('aria-busy', 'true'); output.setAttribute('role', 'status');
      output.textContent = t('Loading applications…', 'جارٍ تحميل الطلبات…');
      var query = '?status=' + encodeURIComponent(filter.value);
      if (append && nextCursor) query += '&cursor=' + encodeURIComponent(nextCursor);
      try {
        var result = await api('/api/admin/applications' + query);
        if (!current(revision) || localRequest !== request) return;
        var incoming = Array.isArray(result.applications) ? result.applications : [];
        rows = append ? rows.concat(incoming) : incoming;
        nextCursor = result.next_cursor || null;
        var recoverFocus = list.contains(document.activeElement);
        list.replaceChildren();
        rows.forEach(function (application) { list.appendChild(applicationRow(application, revision, function () { loadQueue(false); }, draft && draft.notes)); });
        output.textContent = rows.length ? t('Applications loaded. Review each request before making a decision.', 'تم تحميل الطلبات. راجع كل طلب قبل اتخاذ القرار.') : t('No applications match this status.', 'لا توجد طلبات بهذه الحالة.');
        if (result.counts && typeof result.counts.pending === 'number') {
          totals.textContent = t('Awaiting review: ', 'بانتظار المراجعة: ') + result.counts.pending + ' · ' + t('Approved: ', 'معتمدة: ') + result.counts.approved + ' · ' + t('Declined: ', 'مرفوضة: ') + result.counts.rejected;
        } else totals.textContent = t('Applications shown: ', 'الطلبات المعروضة: ') + rows.length + (nextCursor ? t(' — more available', ' — تتوفر طلبات إضافية') : '');
        more.hidden = !nextCursor;
        if (recoverFocus) { output.tabIndex = -1; output.focus({ preventScroll: true }); }
      } catch (error) {
        if (!current(revision) || localRequest !== request) return;
        output.textContent = errorText(error); output.setAttribute('role', 'alert');
      } finally {
        if (current(revision) && localRequest === request) {
          isLoading = false; filter.disabled = false; refresh.disabled = false; more.disabled = false; list.removeAttribute('aria-busy');
        }
      }
    }
    filter.addEventListener('change', function () { loadQueue(false); });
    await loadQueue(false);
  }

  async function render(route, languageDraft) {
    route = String(route || 'community').replace(/^#?\/?/, '').split(/[?#]/)[0];
    if (['community', 'join', 'signin', 'admin'].indexOf(route) < 0) route = 'community';
    state.route = route;
    var revision = ++state.revision;
    var root = document.getElementById('community-root');
    if (!root) return;
    var recoverFocus = root.contains(document.activeElement);
    root.replaceChildren(); root.setAttribute('aria-busy', 'true');
    var layout = el('div', 'community-layout');
    root.appendChild(layout);
    var titles = {
      community: [t('Membership', 'العضوية'), t('Membership', 'العضوية'), t('The members’ area of the Iraqi Academic Youth Association UK, with secure sign-in and committee-approved membership.', 'مساحة أعضاء الجمعية العراقية الأكاديمية للشباب في المملكة المتحدة، بتسجيل دخول آمن وعضوية تعتمدها اللجنة.')],
      join: [t('Membership', 'العضوية'), t('Membership application', 'طلب العضوية'), t('Sign in with Google and complete your application. Membership is confirmed once the committee has approved it.', 'سجّل الدخول بحساب Google وأكمل طلبك، وتُعتمد العضوية بعد موافقة اللجنة.')],
      signin: [t('Membership', 'العضوية'), t('Member sign-in', 'دخول الأعضاء'), t('Sign in securely to follow your application or to enter the members’ area.', 'سجّل الدخول بأمان لمتابعة طلبك أو للدخول إلى مساحة الأعضاء.')],
      admin: [t('Committee', 'اللجنة'), t('Membership review', 'مراجعة طلبات العضوية'), t('Review applications and manage access to the members’ area.', 'مراجعة طلبات العضوية وإدارة صلاحيات الوصول إلى مساحة الأعضاء.')]
    };
    var pageTitle = heading(layout, titles[route][0], titles[route][1], titles[route][2]);
    if (recoverFocus) pageTitle.focus({ preventScroll: true });
    var output = notice(t('Checking your account…', 'جارٍ التحقق من حسابك…')); layout.appendChild(output);
    try {
      var results = await Promise.allSettled([api('/api/session'), api('/api/config')]);
      if (!current(revision) || !root.isConnected) return;
      if (results[0].status !== 'fulfilled') throw results[0].reason;
      state.session = results[0].value;
      state.config = results[1].status === 'fulfilled' ? results[1].value : { configured: false };
      var draft = languageDraft && languageDraft.route === route && languageDraft.userId === ((state.session.user || {}).id || null) ? languageDraft : null;
      output.remove(); root.removeAttribute('aria-busy');
      if (route === 'admin') { await adminArea(layout, revision, draft && draft.admin); return; }
      if (!state.session.authenticated) { publicCommunity(layout, revision, route); return; }
      var account = accountPanel(layout, revision);
      var membership = state.session.membership;
      if (membership && membership.status === 'approved') {
        if (route === 'community') await membersArea(layout, revision);
        else {
          var welcome = el('section', 'auth-panel');
          add(welcome, badge('approved'), el('h2', '', t('Your membership is active', 'عضويتك مفعّلة')), el('p', '', t('You can now access the association members area.', 'يمكنك الآن دخول مساحة أعضاء الجمعية.')), link(t('Enter the community', 'ادخل المجتمع'), 'community', true));
          layout.appendChild(welcome);
        }
      } else if (membership && membership.status === 'pending') membershipStatus(layout, membership);
      else if (route === 'join') {
        if (membership && membership.status === 'rejected') membershipStatus(layout, membership);
        membershipForm(layout, revision, membership && membership.status === 'rejected' ? membership : null, draft && draft.membership);
      } else {
        if (membership && membership.status === 'rejected') membershipStatus(layout, membership);
        add(account, el('p', '', t('Complete a membership application to request access to the community.', 'أكمل طلب العضوية لطلب الوصول إلى المجتمع.')), link(t(membership ? 'Revise your application' : 'Apply for membership', membership ? 'حدّث طلبك' : 'قدّم طلب العضوية'), 'join', true));
      }
    } catch (error) {
      if (!current(revision)) return;
      root.removeAttribute('aria-busy'); output.textContent = errorText(error); output.setAttribute('role', 'alert');
      layout.appendChild(button(t('Try again', 'حاول مجدداً'), function () { render(state.route); }, false));
      layout.appendChild(link(t('Contact the association', 'تواصل مع الجمعية'), 'contact', false));
    }
  }

  window.IAYACommunity = {
    render: render,
    leave: function () { state.revision++; },
    onLanguageChange: function () {
      // Only retain unsent fields during this language change, in memory. Never
      // persist account or application information in browser storage.
      var draft = { route: state.route, userId: ((state.session && state.session.user) || {}).id || null };
      var name = document.getElementById('membership-full_name');
      if (name) {
        draft.membership = { full_name: name.value };
        ['university', 'field', 'message'].forEach(function (key) {
          var input = document.getElementById('membership-' + key);
          draft.membership[key] = input ? input.value : '';
        });
        var consent = document.getElementById('membership-consent');
        draft.membership.consent = Boolean(consent && consent.checked);
      }
      var filter = document.getElementById('application-status-filter');
      var root = document.getElementById('community-root');
      if (filter && root) {
        draft.admin = { filter: filter.value, notes: Object.create(null) };
        root.querySelectorAll('textarea[data-review-id]').forEach(function (note) {
          draft.admin.notes[note.getAttribute('data-review-id')] = note.value;
        });
      }
      return render(state.route, draft);
    }
  };
}());
