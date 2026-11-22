/*! Eretek Online Araçlar #16 — Microsoft 365 DNS Kontrolü */
ERT.def('16', {
	run: function (v, c) {
		var D = ERT.dns, d = D.normName(v.domain);
		if (!d) { throw c.fe('domain', 'badDomain'); }
		var sels = String(v.sel || 'selector1,selector2').split(/[,\s]+/).filter(Boolean);
		for (var i = 0; i < sels.length; i++) { if (!/^[a-z0-9_-]{1,63}$/i.test(sels[i])) { throw c.fe('sel', 'badSel'); } }
		var q = [D.query(d, 'MX'), D.txt(d), D.query('autodiscover.' + d, 'CNAME'), D.txt('_dmarc.' + d)].concat(sels.map(function (s) { return D.query(s + '._domainkey.' + d, 'CNAME'); }));
		return Promise.all(q).then(function (r) {
			var rows = [], cls = [], vv = {};
			var add = function (rec, name, obs, exp, st) { rows.push([rec, name, obs || '–', exp, c.t('s_' + st)]); cls.push({ ok: 'ok', ext: 'warn', miss: 'err', dup: 'err', unv: '', info: '' }[st]); vv[rec] = st; };
			var errStat = function (x) { return x.status !== 'ok' && x.status !== 'nodata' && x.status !== 'nxdomain'; };
			// MX
			var mx = r[0], mxs = mx.answers.map(function (a) { return a.data.replace(/\.$/, '').toLowerCase(); });
			if (errStat(mx)) { add('MX', d, c.t('st_' + mx.status), '*.mail.protection.outlook.com / *.mx.microsoft', 'unv'); }
			else if (!mxs.length) { add('MX', d, c.t('st_' + mx.status), '*.mail.protection.outlook.com / *.mx.microsoft', 'miss'); }
			else {
				var exp = (v.mx || '').trim().toLowerCase().replace(/\.$/, '');
				var hit = mxs.some(function (m) { var h = m.split(' ').pop(); return exp ? h === exp : /\.mail\.protection\.outlook\.com$|\.mx\.microsoft$/.test(h); });
				add('MX', d, mxs.join(' | '), exp || '*.mail.protection.outlook.com / *.mx.microsoft', hit ? 'ok' : 'ext');
			}
			// SPF
			var spf = r[1].texts ? r[1].texts.filter(function (t) { return /^v=spf1(\s|$)/i.test(t); }) : [];
			if (errStat(r[1])) { add('SPF', d, c.t('st_' + r[1].status), 'include:spf.protection.outlook.com', 'unv'); }
			else if (spf.length > 1) { add('SPF', d, spf.join(' | '), 'include:spf.protection.outlook.com', 'dup'); }
			else if (!spf.length) { add('SPF', d, '', 'include:spf.protection.outlook.com', 'miss'); }
			else { add('SPF', d, spf[0], 'include:spf.protection.outlook.com', /include:spf\.protection\.outlook\.com/i.test(spf[0]) ? 'ok' : 'ext'); }
			// Autodiscover
			var au = r[2], aut = au.answers.map(function (a) { return a.data.replace(/\.$/, '').toLowerCase(); });
			if (errStat(au)) { add('Autodiscover', 'autodiscover.' + d, c.t('st_' + au.status), 'autodiscover.outlook.com', 'unv'); }
			else { add('Autodiscover', 'autodiscover.' + d, aut.join(' | ') || c.t('st_' + au.status), 'autodiscover.outlook.com', aut.indexOf('autodiscover.outlook.com') !== -1 ? 'ok' : (aut.length ? 'ext' : 'miss')); }
			// DMARC
			var dm = r[3].texts ? r[3].texts.filter(function (t) { return /^v=DMARC1/i.test(t); }) : [];
			if (errStat(r[3])) { add('DMARC', '_dmarc.' + d, c.t('st_' + r[3].status), 'v=DMARC1; p=…', 'unv'); }
			else { add('DMARC', '_dmarc.' + d, dm.join(' | '), 'v=DMARC1; p=…', dm.length === 1 ? 'ok' : (dm.length > 1 ? 'dup' : 'miss')); }
			// DKIM
			sels.forEach(function (s, k) {
				var x = r[4 + k], tg = x.answers.map(function (a) { return a.data.replace(/\.$/, '').toLowerCase(); }), nm = s + '._domainkey.' + d;
				var expD = (v.dkim || '').trim().toLowerCase();
				if (errStat(x)) { add('DKIM ' + s, nm, c.t('st_' + x.status), s + '-…._domainkey.….onmicrosoft.com / ….dkim.mail.microsoft', 'unv'); return; }
				var ok = tg.some(function (h) { return expD ? h.indexOf(expD) !== -1 : /\._domainkey\.[a-z0-9-]+\.(?:onmicrosoft\.com|r-v1\.dkim\.mail\.microsoft)$/.test(h) || /\.dkim\.mail\.microsoft$/.test(h); });
				add('DKIM ' + s, nm, tg.join(' | ') || c.t('st_' + x.status), s + '-…._domainkey.….onmicrosoft.com / ….dkim.mail.microsoft', ok ? 'ok' : (tg.length ? 'ext' : 'miss'));
			});
			var msgs = [['info', c.t('dkimNote')], ['info', c.t('extNote')]];
			var cols = [c.t('c_rec'), c.t('c_name'), c.t('c_obs'), c.t('c_exp'), c.t('c_st')];
			return { big: c.t('big', { d: d }), tables: [{ cols: cols, rows: rows, cls: cls }], msgs: msgs, x: { copy: rows.map(function (r2) { return r2.join('\t'); }).join('\n') }, v: vv };
		});
	}
});
