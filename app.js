let deposits = [];
let editingId = null;

const TAB_BUTTON_INDEX = {
    list: 0,
    reminder: 1,
    calendar: 2
};

document.addEventListener('DOMContentLoaded', function () {
    deposits = loadData();
    initNotifications();
    initDepositedToggle();
    updateStats();
    renderList();
    renderReminders();
    checkDueReminders(true);

    setInterval(() => checkDueReminders(false), 60000);

    document.getElementById('depositForm').addEventListener('submit', handleFormSubmit);
});

function refreshAll() {
    updateStats();
    renderList();
    renderCalendar();
    renderReminders();
}

function formatMoney(amount) {
    return '¥' + amount.toLocaleString('zh-CN');
}

function getDepositedItems() {
    return deposits.filter(d => d.deposited);
}

function updateStats() {
    const depositedItems = getDepositedItems();
    const totalCount = depositedItems.length;
    const totalPrincipal = depositedItems.reduce((sum, d) => sum + d.principal, 0);

    // 只统计存续中的已存入存单
    const activeDeposited = depositedItems.filter(d => d.status === 'active');

    // 累计已产生利息 = 所有存续已存入存单的累计利息之和
    const accruedInterest = activeDeposited
        .reduce((sum, d) => sum + calcAccruedInterest(d.principal, d.rate, d.term, d.depositDate), 0);

    // 总本息和 = 总本金 + 累计已产生利息（保持等式始终成立）
    const totalAmount = totalPrincipal + accruedInterest;

    document.getElementById('totalCount').textContent = totalCount;
    document.getElementById('totalPrincipal').textContent = formatMoney(totalPrincipal);
    document.getElementById('monthDue').textContent = formatMoney(accruedInterest);
    document.getElementById('yearDue').textContent = formatMoney(totalAmount);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active');
        el.setAttribute('aria-selected', 'false');
    });

    document.getElementById('tab-' + tabName).classList.add('active');
    const buttons = document.querySelectorAll('.tab-btn');
    const index = TAB_BUTTON_INDEX[tabName];
    if (buttons[index]) {
        buttons[index].classList.add('active');
        buttons[index].setAttribute('aria-selected', 'true');
    }

    if (tabName === 'calendar') renderCalendar();
    else if (tabName === 'reminder') renderReminders();
}

function renderList() {
    const statusFilter = document.getElementById('filterStatus').value;
    const typeFilter = document.getElementById('filterType').value;

    let filtered = deposits;
    if (statusFilter) filtered = filtered.filter(d => d.status === statusFilter);
    if (typeFilter) filtered = filtered.filter(d => d.type === typeFilter);

    filtered.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const container = document.getElementById('depositList');
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无存单数据</div>';
        return;
    }

    container.innerHTML = filtered.map(d => {
        const daysLeft = getDaysLeft(d.dueDate);
        const daysInfo = getDaysInfo(daysLeft);
        const canRenew = d.status === 'active' && d.rule !== 'liquid';
        const renewBtn = canRenew
            ? `<button class="btn-renew" onclick="renewDeposit(${d.id})">续存</button>`
            : '';
        const interest = calcInterest(d.principal, d.rate, d.term);
        const depositedClass = d.deposited ? 'deposited-yes' : 'deposited-no';
        const depositedText = d.deposited ? '已存入' : '未存入';

        return `
            <div class="deposit-card ${d.deposited ? '' : 'not-deposited'}">
                <div class="deposit-header">
                    <div class="deposit-info">
                        <div class="deposit-principal">${formatMoney(d.principal)}</div>
                        <div class="deposit-meta">${d.depositMonth} 存入 · ${d.term}年期 · ${d.depositDate}</div>
                    </div>
                    <div class="deposit-badges">
                        <span class="deposit-badge badge-${d.type}">${typeDescriptions[d.type]}</span>
                        <span class="deposit-badge badge-${d.status}">${statusDescriptions[d.status]}</span>
                        <span class="deposit-badge ${depositedClass}">${depositedText}</span>
                    </div>
                </div>
                <div class="deposit-details">
                    <div class="deposit-detail"><label>到期日期</label><span>${d.dueDate}</span></div>
                    <div class="deposit-detail"><label>剩余天数</label><span class="${daysInfo.className}">${daysInfo.text}</span></div>
                    <div class="deposit-detail"><label>年利率</label><span>${d.rate != null ? d.rate + '%' : '-'}</span></div>
                    <div class="deposit-detail"><label>预计利息</label><span class="interest-amount">${formatMoney(interest)}</span></div>
                    <div class="deposit-detail"><label>到期本息合计</label><span class="interest-amount">${formatMoney(d.principal + interest)}</span></div>
                    <div class="deposit-detail"><label>续存规则</label><span>${d.ruleDesc || ruleDescriptions[d.rule]}</span></div>
                </div>
                <div class="deposit-actions">
                    <button class="btn-edit" onclick="showEditModal(${d.id})">编辑</button>
                    ${renewBtn}
                    <button class="btn-delete" onclick="deleteDeposit(${d.id})">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

function getDaysLeft(dueDateStr) {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
}

function getDaysInfo(days) {
    if (days < 0) return { text: `已过期 ${Math.abs(days)} 天`, className: 'text-expired' };
    if (days === 0) return { text: '今日到期', className: 'text-today' };
    if (days <= 7) return { text: `${days} 天后到期（7 天内）`, className: 'text-week' };
    if (days <= 30) return { text: `${days} 天后到期（30 天内）`, className: 'text-month' };
    return { text: `${days} 天后到期`, className: 'text-future' };
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
    editingId = null;
}

function closeBatchModal() {
    document.getElementById('batchModal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
}

function closeReminderModal() {
    document.getElementById('reminderModal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
}

function closeAllModals() {
    closeModal();
    closeBatchModal();
    closeReminderModal();
}

function initDepositedToggle() {
    const cb = document.getElementById('formDeposited');
    const label = document.getElementById('formDepositedLabel');
    if (!cb || !label) return;
    const update = () => {
        label.textContent = cb.checked ? '已存入' : '未存入';
    };
    cb.addEventListener('change', update);
}

function showAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent = '新增存单';
    document.getElementById('formDepositDate').value = '';
    document.getElementById('formTerm').value = '1';
    document.getElementById('formPrincipal').value = '';
    document.getElementById('formRate').value = '1.5';
    document.getElementById('formType').value = 'new';
    document.getElementById('formRule').value = 'renew3';
    document.getElementById('formStatus').value = 'active';
    const cb = document.getElementById('formDeposited');
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    openModal('modal');
}

function showEditModal(id) {
    const deposit = deposits.find(d => d.id === id);
    if (!deposit) return;

    editingId = id;
    document.getElementById('modalTitle').textContent = '编辑存单';
    document.getElementById('formDepositDate').value = deposit.depositDate;
    document.getElementById('formTerm').value = deposit.term;
    document.getElementById('formPrincipal').value = deposit.principal;
    document.getElementById('formRate').value = deposit.rate != null ? deposit.rate : '';
    document.getElementById('formType').value = deposit.type;
    document.getElementById('formRule').value = deposit.rule;
    document.getElementById('formStatus').value = deposit.status;
    const cb = document.getElementById('formDeposited');
    cb.checked = !!deposit.deposited;
    cb.dispatchEvent(new Event('change'));
    openModal('modal');
}

function handleFormSubmit(e) {
    e.preventDefault();

    const depositDate = document.getElementById('formDepositDate').value;
    const term = parseFloat(document.getElementById('formTerm').value);
    const principal = parseFloat(document.getElementById('formPrincipal').value);
    const rate = parseFloat(document.getElementById('formRate').value);
    const type = document.getElementById('formType').value;
    const rule = document.getElementById('formRule').value;
    const status = document.getElementById('formStatus').value;
    const deposited = document.getElementById('formDeposited').checked;

    if (!depositDate || isNaN(term) || term <= 0 || isNaN(principal) || principal <= 0 || isNaN(rate) || rate < 0) {
        alert('请填写完整且有效的信息');
        return;
    }

    const dateParts = depositDate.split('-').map(Number);
    const dueDate = calculateDueDate(dateParts[0], dateParts[1], dateParts[2], term);
    const depositMonth = getDepositMonth(depositDate);

    if (editingId) {
        const index = deposits.findIndex(d => d.id === editingId);
        if (index !== -1) {
            deposits[index] = {
                ...deposits[index],
                depositMonth,
                depositDate,
                term,
                principal,
                rate,
                dueDate,
                type,
                rule,
                status,
                deposited,
                ruleDesc: ruleDescriptions[rule]
            };
        }
    } else {
        deposits.push({
            id: getNextId(deposits),
            depositMonth,
            depositDate,
            term,
            principal,
            rate,
            dueDate,
            status,
            type,
            rule,
            deposited,
            ruleDesc: ruleDescriptions[rule]
        });
    }

    saveData(deposits);
    refreshAll();
    closeModal();
}

function deleteDeposit(id) {
    if (confirm('确定要删除这张存单吗？')) {
        deposits = deposits.filter(d => d.id !== id);
        saveData(deposits);
        refreshAll();
    }
}

function renewDeposit(id) {
    const index = deposits.findIndex(d => d.id === id);
    if (index === -1) return;

    const d = deposits[index];
    if (d.status !== 'active') return;

    if (d.rule === 'liquid') {
        if (!confirm('该存单规则为"到期划入流动资金"，是否标记为已到期？')) return;
        deposits[index] = { ...d, status: 'matured' };
    } else {
        if (!confirm(`确认按规则"${d.ruleDesc || ruleDescriptions[d.rule]}"续存该存单？`)) return;

        const newTerm = d.rule === 'renew3' ? 3 : d.term;
        const newDepositDate = d.dueDate;
        const dateParts = newDepositDate.split('-').map(Number);
        const newDueDate = calculateDueDate(dateParts[0], dateParts[1], dateParts[2], newTerm);
        const newRule = newTerm === 3 ? 'renewSame' : d.rule;
        const newRuleDesc = ruleDescriptions[newRule];

        deposits[index] = { ...d, status: 'renewed' };
        deposits.push({
            id: getNextId(deposits),
            depositMonth: getDepositMonth(newDepositDate),
            depositDate: newDepositDate,
            term: newTerm,
            principal: d.principal,
            rate: d.rate,
            dueDate: newDueDate,
            status: 'active',
            type: d.type,
            rule: newRule,
            ruleDesc: newRuleDesc,
            deposited: true
        });
    }

    saveData(deposits);
    refreshAll();
}

function showBatchModal() {
    openModal('batchModal');
}

function applyBatchAmount() {
    const amount = parseFloat(document.getElementById('batchAmount').value);
    const scopeEl = document.querySelector('input[name="batchScope"]:checked');
    if (!scopeEl) return;
    const scope = scopeEl.value;

    if (!amount || amount <= 0) {
        alert('请输入有效的金额');
        return;
    }

    deposits = deposits.map(d => {
        if (scope === 'all' || scope === d.type) {
            return { ...d, principal: amount };
        }
        return d;
    });

    saveData(deposits);
    refreshAll();
    closeBatchModal();
}

function renderCalendar() {
    const container = document.getElementById('monthlyCashFlow');
    const currentYear = new Date().getFullYear();
    const startYear = currentYear;
    const endYear = currentYear + 9;

    let html = '<div class="calendar-matrix">';
    html += '<div class="cal-row cal-header"><div class="cal-year-cell">年份</div>';
    for (let m = 1; m <= 12; m++) {
        html += `<div class="cal-month-header">${m}月</div>`;
    }
    html += '</div>';

    for (let year = startYear; year <= endYear; year++) {
        html += `<div class="cal-row"><div class="cal-year-cell">${year}</div>`;
        for (let month = 1; month <= 12; month++) {
            const monthDeposits = deposits.filter(d => {
                if (d.status !== 'active' || !d.deposited) return false;
                const due = new Date(d.dueDate);
                return due.getFullYear() === year && due.getMonth() === month - 1;
            });
            const totalPrincipal = monthDeposits.reduce((sum, d) => sum + d.principal, 0);
            const totalInterest = monthDeposits.reduce((sum, d) => sum + calcInterest(d.principal, d.rate, d.term), 0);
            const total = totalPrincipal + totalInterest;
            const count = monthDeposits.length;
            const hasData = total > 0;

            html += `
                <div class="cal-cell ${hasData ? 'has-data' : ''}" title="${count} 张存单到期">
                    <div class="cal-cell-month">${month}月</div>
                    <div class="cal-cell-amount">${hasData ? formatMoney(total) : '-'}</div>
                    ${hasData ? `<div class="cal-cell-count">${count} 张 · 本金${formatMoney(totalPrincipal)}+利息${formatMoney(totalInterest)}</div>` : ''}
                </div>
            `;
        }
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}

function renderReminders() {
    const container = document.getElementById('reminderList');
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const reminders = deposits
        .filter(d => d.status === 'active' && d.deposited)
        .map(d => {
            const dueDate = new Date(d.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
            return { ...d, daysLeft };
        })
        .filter(d => d.daysLeft >= 0 && d.daysLeft <= 30)
        .sort((a, b) => a.daysLeft - b.daysLeft);

    if (reminders.length === 0) {
        container.innerHTML = '<div class="empty-state">30 天内无到期存单</div>';
        return;
    }

    container.innerHTML = reminders.map(d => {
        let urgency = 'month';
        if (d.daysLeft === 0) urgency = 'today';
        else if (d.daysLeft <= 7) urgency = 'week';

        const daysText = d.daysLeft === 0 ? '今日到期' : `${d.daysLeft} 天后到期`;
        const interest = calcInterest(d.principal, d.rate, d.term);
        const total = d.principal + interest;

        return `
            <div class="reminder-card ${urgency}">
                <div class="reminder-header">
                    <div class="reminder-title">${d.depositMonth} · ${d.term}年期 · ${typeDescriptions[d.type]}</div>
                    <span class="reminder-days">${daysText}</span>
                </div>
                <div class="reminder-principal">${formatMoney(total)} <span class="reminder-breakdown">（本金${formatMoney(d.principal)} + 利息${formatMoney(interest)}）</span></div>
                <div class="reminder-info">存入: ${d.depositDate} | 到期: ${d.dueDate} | ${d.ruleDesc || ruleDescriptions[d.rule]}</div>
            </div>
        `;
    }).join('');
}

function getDueGroups() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const active = deposits.filter(d => d.status === 'active' && d.deposited);
    const todayDue = [];
    const weekDue = [];
    const monthDue = [];

    active.forEach(d => {
        const due = new Date(d.dueDate);
        due.setHours(0, 0, 0, 0);
        const days = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        if (days === 0) todayDue.push(d);
        else if (days > 0 && days <= 7) weekDue.push(d);
        else if (days > 7 && days <= 30) monthDue.push(d);
    });

    const sum = arr => arr.reduce((s, d) => s + d.principal + calcInterest(d.principal, d.rate, d.term), 0);

    return {
        today: todayDue,
        week: weekDue,
        month: monthDue,
        total: todayDue.length + weekDue.length + monthDue.length,
        todayAmount: sum(todayDue),
        weekAmount: sum(weekDue),
        monthAmount: sum(monthDue)
    };
}

function buildNotifyText(groups) {
    const parts = [];
    if (groups.today.length) parts.push(`今日到期 ${groups.today.length} 张，本息合计 ${formatMoney(groups.todayAmount)}`);
    if (groups.week.length) parts.push(`7 天内到期 ${groups.week.length} 张，本息合计 ${formatMoney(groups.weekAmount)}`);
    if (groups.month.length) parts.push(`30 天内到期 ${groups.month.length} 张，本息合计 ${formatMoney(groups.monthAmount)}`);
    return parts.join('；');
}

function showReminderModalContent(groups) {
    const modalContent = document.getElementById('reminderModalContent');
    const rows = [];
    if (groups.today.length) rows.push(`<div class="reminder-section today"><strong>今日到期</strong><span>${groups.today.length} 张 · ${formatMoney(groups.todayAmount)}</span></div>`);
    if (groups.week.length) rows.push(`<div class="reminder-section week"><strong>7 天内到期</strong><span>${groups.week.length} 张 · ${formatMoney(groups.weekAmount)}</span></div>`);
    if (groups.month.length) rows.push(`<div class="reminder-section month"><strong>30 天内到期</strong><span>${groups.month.length} 张 · ${formatMoney(groups.monthAmount)}</span></div>`);

    modalContent.innerHTML = `
        <div style="padding: 20px;">
            <div style="font-size: 18px; font-weight: 700; margin-bottom: 16px; color: var(--danger);">到期提醒</div>
            <div class="reminder-summary">${rows.join('')}</div>
            <button onclick="closeReminderModal()" class="btn btn-primary" style="width: 100%; margin-top: 16px;">知道了</button>
        </div>
    `;
    document.getElementById('reminderModal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function checkDueReminders(showModal) {
    const groups = getDueGroups();
    if (groups.total === 0) return;

    if (showModal) {
        showReminderModalContent(groups);
    }

    sendBrowserNotification('36存单到期提醒', buildNotifyText(groups));
}

// 浏览器通知相关
let notifyEnabled = false;

function initNotifications() {
    const btn = document.getElementById('enableNotifyBtn');
    if (!('Notification' in window)) {
        btn.textContent = '通知不可用';
        btn.disabled = true;
        return;
    }

    if (Notification.permission === 'granted') {
        notifyEnabled = true;
        updateNotifyBtn(btn, true);
    } else if (Notification.permission === 'denied') {
        btn.textContent = '通知被拒绝';
        btn.disabled = true;
    }

    btn.addEventListener('click', requestNotifyPermission);
}

function updateNotifyBtn(btn, enabled) {
    btn.textContent = enabled ? '通知已开启' : '开启通知';
    btn.classList.toggle('active', enabled);
}

async function requestNotifyPermission() {
    const btn = document.getElementById('enableNotifyBtn');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        notifyEnabled = true;
        updateNotifyBtn(btn, true);
        new Notification('36存单管理工具', { body: '已开启到期通知提醒' });
    } else {
        notifyEnabled = false;
        updateNotifyBtn(btn, false);
    }
}

function sendBrowserNotification(title, body) {
    if (!notifyEnabled || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body });
}
