const STORAGE_KEY = 'deposit_36_v4';

// 36 存单建设周期：2026-08 至 2027-06，共 11 个月，每月 22 号存入
const depositDates = [
    { year: 2026, month: 8, day: 22 },
    { year: 2026, month: 9, day: 22 },
    { year: 2026, month: 10, day: 22 },
    { year: 2026, month: 11, day: 22 },
    { year: 2026, month: 12, day: 22 },
    { year: 2027, month: 1, day: 22 },
    { year: 2027, month: 2, day: 22 },
    { year: 2027, month: 3, day: 22 },
    { year: 2027, month: 4, day: 22 },
    { year: 2027, month: 5, day: 22 },
    { year: 2027, month: 6, day: 22 }
];

function toMonthStr(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function getDepositMonth(dateStr) {
    return dateStr.slice(0, 7);
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function calculateDueDate(year, month, day, termYears) {
    // 整数年保持原有精确逻辑（年月直接相加，闰年 2/29 处理为 2/28）
    if (Number.isInteger(termYears)) {
        let dueYear = year + termYears;
        let dueMonth = month;
        let dueDay = day;
        if (month === 2 && day === 29 && !isLeapYear(dueYear)) {
            dueDay = 28;
        }
        return `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    }

    // 非整数年按月份加法（如 0.5 年 = 6 个月）
    const totalMonths = Math.round(termYears * 12);
    const date = new Date(year, month - 1, day);
    const expectedDay = day;
    date.setMonth(date.getMonth() + totalMonths);
    // 若因月末溢出导致日期变化（如 1.31 + 1个月），回退到该月最后一天
    if (date.getDate() !== expectedDay) {
        date.setDate(0);
    }
    const dueYear = date.getFullYear();
    const dueMonth = date.getMonth() + 1;
    const dueDay = date.getDate();
    return `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
}

function calcInterest(principal, rate, term) {
    if (!rate || rate <= 0 || !term || term <= 0) return 0;
    return Math.round(principal * (rate / 100) * term);
}

function calcAccruedInterest(principal, rate, term, depositDateStr) {
    const totalInterest = calcInterest(principal, rate, term);
    if (totalInterest <= 0) return 0;

    const depositDate = new Date(depositDateStr);
    depositDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateParts = depositDateStr.split('-').map(Number);
    const dueDate = new Date(calculateDueDate(dateParts[0], dateParts[1], dateParts[2], term));
    dueDate.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.ceil((dueDate - depositDate) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((today - depositDate) / (1000 * 60 * 60 * 24))));

    return Math.round(totalInterest * (elapsedDays / totalDays));
}

function generateNew36Deposits(amount = 1800) {
    const deposits = [];
    let id = 1;

    depositDates.forEach(date => {
        const depositDate = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
        const depositMonth = toMonthStr(date.year, date.month);

        deposits.push({
            id: id++,
            depositMonth,
            depositDate,
            term: 1,
            principal: amount,
            rate: 1.5,
            dueDate: calculateDueDate(date.year, date.month, date.day, 1),
            status: 'active',
            type: 'new',
            rule: 'renew3',
            ruleDesc: '到期本金续存 3 年期',
            deposited: false
        });

        deposits.push({
            id: id++,
            depositMonth,
            depositDate,
            term: 2,
            principal: amount,
            rate: 2.0,
            dueDate: calculateDueDate(date.year, date.month, date.day, 2),
            status: 'active',
            type: 'new',
            rule: 'renew3',
            ruleDesc: '到期本金续存 3 年期',
            deposited: false
        });

        deposits.push({
            id: id++,
            depositMonth,
            depositDate,
            term: 3,
            principal: amount,
            rate: 2.5,
            dueDate: calculateDueDate(date.year, date.month, date.day, 3),
            status: 'active',
            type: 'new',
            rule: 'renewSame',
            ruleDesc: '到期滚动续存 3 年期',
            deposited: false
        });
    });

    return deposits;
}

function generateExistingDeposits() {
    return [
        {
            id: 34,
            depositMonth: '2023-08',
            depositDate: '2023-08-22',
            term: 3,
            principal: 70000,
            rate: 2.5,
            dueDate: '2026-08-22',
            status: 'active',
            type: 'existing',
            rule: 'liquid',
            ruleDesc: '到期拆分：10,000 元应急金 + 60,000 元存单建设资金',
            deposited: true
        },
        {
            id: 35,
            depositMonth: '2023-12',
            depositDate: '2023-12-12',
            term: 3,
            principal: 10000,
            rate: 2.5,
            dueDate: '2026-12-12',
            status: 'active',
            type: 'existing',
            rule: 'liquid',
            ruleDesc: '到期作为后备增补资金，不纳入基础预算',
            deposited: true
        },
        {
            id: 36,
            depositMonth: '2026-05',
            depositDate: '2026-05-08',
            term: 3,
            principal: 5000,
            rate: 2.5,
            dueDate: '2029-05-08',
            status: 'active',
            type: 'existing',
            rule: 'renew3',
            ruleDesc: '到期本金滚动存 3 年期',
            deposited: true
        },
        {
            id: 37,
            depositMonth: '2026-05',
            depositDate: '2026-05-19',
            term: 3,
            principal: 1500,
            rate: 2.5,
            dueDate: '2029-05-19',
            status: 'active',
            type: 'existing',
            rule: 'renew3',
            ruleDesc: '到期本金滚动存 3 年期',
            deposited: true
        },
        {
            id: 38,
            depositMonth: '2026-06',
            depositDate: '2026-06-01',
            term: 3,
            principal: 2000,
            rate: 2.5,
            dueDate: '2029-06-01',
            status: 'active',
            type: 'existing',
            rule: 'renew3',
            ruleDesc: '到期本金滚动存 3 年期',
            deposited: true
        },
        {
            id: 39,
            depositMonth: '2026-06',
            depositDate: '2026-06-04',
            term: 3,
            principal: 2000,
            rate: 2.5,
            dueDate: '2029-06-04',
            status: 'active',
            type: 'existing',
            rule: 'renew3',
            ruleDesc: '到期本金滚动存 3 年期',
            deposited: true
        },
        {
            id: 40,
            depositMonth: '2026-07',
            depositDate: '2026-07-02',
            term: 3,
            principal: 5000,
            rate: 2.5,
            dueDate: '2029-07-02',
            status: 'active',
            type: 'existing',
            rule: 'renew3',
            ruleDesc: '到期本金滚动存 3 年期',
            deposited: true
        }
    ];
}

function getInitialData() {
    return [
        ...generateNew36Deposits(1800),
        ...generateExistingDeposits()
    ];
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch {
            return getInitialData();
        }
    }
    return getInitialData();
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getNextId(data) {
    if (data.length === 0) return 1;
    return Math.max(...data.map(d => d.id)) + 1;
}

const ruleDescriptions = {
    'renew3': '到期本金续存 3 年期',
    'renewSame': '到期滚动续存同期限',
    'liquid': '到期划入流动资金（不续存）'
};

const statusDescriptions = {
    'active': '存续',
    'matured': '已到期',
    'renewed': '已续存'
};

const typeDescriptions = {
    'new': '新36存单',
    'existing': '现有存单'
};
