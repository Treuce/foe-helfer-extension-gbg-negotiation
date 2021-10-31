/*
 * **************************************************************************************
 * Copyright (C) 2021 FoE-Helper team - All Rights Reserved
 * You may use, distribute and modify this code under the
 * terms of the AGPL license.
 *
 * See file LICENSE.md or go to
 * https://github.com//mainIine/foe-helfer-extension/blob/master/LICENSE.md
 * for full license details.
 *
 * **************************************************************************************
 */

// Get Reward From Item Shop
FoEproxy.addHandler('ItemShopService', 'purchaseItem', (data, postData) => {
    if (data['responseData'] === undefined) { return; }

    const d = data.responseData;

    if (d.hasOwnProperty('__class__'))
    {
        if (d.__class__ === 'ItemShopSlot')
        {
            Castle.curShopItems.purchased.count += 1;
            Castle.curShopItems.available.count -= 1;
            Castle.curShopItems.purchased.reward += Castle.curCastlePointsDiff;
            Castle.curShopItems.available.reward -= Castle.curCastlePointsDiff;
            Castle.curShopItems.date = moment(MainParser.getCurrentDateTime()).startOf('day').unix();
            localStorage.setItem('CastleCurShopItems', JSON.stringify(Castle.curShopItems));
        }

        Castle.ShowProgressTable();
    }
});

//Collect Auction Reward
FoEproxy.addHandler('ItemAuctionService', 'collectPrize', (data, postData) => {

    if (!data || data['responseData'] === undefined || data.responseData['__class__'] === undefined) { return; }

    if (data.responseData['__class__'] === 'Success')
    {
        let d = JSON.parse(localStorage.getItem('CastleCurAuctionWinning'));
        let startOfDay = moment(MainParser.getCurrentDateTime()).startOf('day').unix();

        if (!d || d.date !== startOfDay)
        {
            d = { date: startOfDay, rewards: [] };
        }

        d.rewards.push({ time: moment(MainParser.getCurrentDateTime()).unix(), reward: Castle.AuctionWinningReward });

        localStorage.setItem('CastleCurAuctionWinning', JSON.stringify(d));

        Castle.curAuctionWinning = d;

        Castle.ShowProgressTable();
    }

});


// Read Shop Items and possible Reward
FoEproxy.addHandler('ItemShopService', 'getShop', (data, postData) => {

    if (data['responseData'] === undefined) { return; }

    const d = data.responseData;

    if (d['context'] && d['context'] === 'antiques_dealer' && d['slots'])
    {
        Castle.curShopItems = {
            purchased: { count: 0, reward: 0 },
            available: { count: 0, reward: 0 }
        };

        d.slots.forEach(item => {
            if (item['cost'] === undefined || item['cost']['resources'] === undefined) { return; }
            let r = item['cost']['resources'];
            let gem = r['gemstones'] ? r['gemstones'] / Castle.ShopGemstonesDivisor : 0;
            let coins = r['trade_coins'] ? r['trade_coins'] / Castle.ShopTradeCoinsDivisor : 0;
            let castlePointsReward = Math.floor(gem + coins);

            if (item['amountRemaining'])
            {
                Castle.curShopItems.available.count += 1;
                Castle.curShopItems.available.reward += castlePointsReward;
            }
            else
            {
                Castle.curShopItems.purchased.count += 1;
                Castle.curShopItems.purchased.reward += castlePointsReward;
            }
        });

        Castle.curShopItems.date = moment(MainParser.getCurrentDateTime()).startOf('day').unix();
        localStorage.setItem('CastleCurShopItems', JSON.stringify(Castle.curShopItems));

        Castle.ShowProgressTable();
    }
});

// Get Gex Encounters Battle/ First Start
FoEproxy.addHandler('GuildExpeditionService', 'getOverview', (data, postData) => {

    if (data['responseData'] === undefined) { return; }

    let r = data.responseData;

    if (r['progress'] === undefined) { return; }

    if (r['progress']['currentEntityId'] === undefined)
    {
        // New Start of Guild Expedition
        r.progress.currentEntityId = 0;
    }
    if (!Castle.curGexLastOfSection || Castle.curGexLastOfSection.progress < r.progress.currentEntityId)
    {
        Castle.curGexLastOfSection = { progress: r.progress.currentEntityId, time: moment(MainParser.getCurrentDateTime()).startOf('day').unix() };
        localStorage.setItem('CastleCurGexLastOfSection', JSON.stringify(Castle.curGexLastOfSection));

        Castle.ShowProgressTable();
    }

});

// Get Gex Encounters after Negotiation
FoEproxy.addHandler('GuildExpeditionService', 'getState', (data, postData) => {

    if (data['responseData'] === undefined || data['responseData'][0] === undefined) { return; }

    let r = data.responseData[0];

    if (r['currentEntityId'] === undefined) { return; }

    if (!Castle.curGexLastOfSection || Castle.curGexLastOfSection.progress < r.currentEntityId)
    {
        Castle.curGexLastOfSection = { progress: r.currentEntityId, time: moment(MainParser.getCurrentDateTime()).startOf('day').unix() };
        localStorage.setItem('CastleCurGexLastOfSection', JSON.stringify(Castle.curGexLastOfSection));

        if (Castle.GexLastOfSectionsIds.includes(r.currentEntityId))
        {
            Castle.ShowProgressTable();
        }
    }

});

// Get new daily challenge
FoEproxy.addHandler('ChallengeService', 'getOptions', (data, postData) => {

    if (data['responseData'] === undefined) { return; }

    let r = data.responseData;

    if (r['options'] === undefined || r['expiresAt'] === undefined) { return; }

    if (r.options.length === 2)
    {
        Castle.curDailyChallenge = { id: null, state: 'select_challenge', expiresAt: r.expiresAt }
        localStorage.setItem('CastleCurDailyChallenge', JSON.stringify(Castle.curDailyChallenge));
    }

    Castle.ShowProgressTable();

});

// Get castle system data
FoEproxy.addHandler('CastleSystemService', 'all', (data, postData) => {

    if (!data || data['responseData'] === undefined || data['requestMethod'] === undefined) { return; }

    if (data.requestMethod === 'getCastleSystemPlayer' ||
        data.requestMethod === 'collectDailyPoints' ||
        data.requestMethod === 'getCastleSystemPlayer')
    {
        Castle.UpdateCastlePoints(data.responseData);
    }

    if (data.requestMethod === 'getOverview')
    {
        Castle.dailyPointsCollectionAvailableAt = data.responseData.dailyPointsCollectionAvailableAt;
        localStorage.setItem('CastleDailyPointsCollectionAvailableAt', Castle.dailyPointsCollectionAvailableAt);

        Castle.ShowProgressTable();
    }

});

// Update SevenDayChallenge 
FoEproxy.addHandler('ChallengeService', 'updateTaskProgress', (data, postData) => {

    if (data['responseData'] === undefined) { return; }

    let d = data.responseData;
    let state = 'in_progress';

    if (!d['flags'] || !d['flags'][0] || d['flags'][0] !== 'static_counter') { return; }

    if (d['currentProgress'] && d['maxProgress'] && d['maxProgress'] === Castle.SevenDayChallenge)
    {
        if (d.currentProgress === d.maxProgress)
        {
            state = 'success';
        }

        Castle.curSevenDayChallenge = { id: d.id, state: state, currentProgress: d.currentProgress }
    }

});

// Collect Challenge Reward
FoEproxy.addHandler('ChallengeService', 'collectReward', (data, postData) => {

    if (!data || data['responseData'] === undefined || data.responseData['__class__'] === undefined) { return; }

    if (data.responseData['__class__'] === 'Success')
    {
        let curDailyChallenge = JSON.parse(localStorage.getItem('CastleCurDailyChallenge'));

        if (curDailyChallenge && curDailyChallenge.id)
        {
            Castle.curDailyChallenge = { id: curDailyChallenge.id, state: 'success', expiresAt: curDailyChallenge.id.expiresAt }
        }
        else
        {
            Castle.curDailyChallenge = { id: null, state: 'success', expiresAt: r.expiresAt }
        }

    }

    Castle.ShowProgressTable();
});

// Get active challenges on startup
FoEproxy.addHandler('ChallengeService', 'getActiveChallenges', (data, postData) => {

    if (data['responseData'] === undefined) { return; }

    let d = data.responseData;

    Castle.curSevenDayChallenge = undefined;

    for (let c in d)
    {
        if (!d.hasOwnProperty(c) || !d[c].type || !d[c].state) continue;

        if (d[c].type === 'daily_challenge')
        {
            Castle.curDailyChallenge = { id: d[c].id, state: d[c].state, expiresAt: d[c].expiresAt };
            localStorage.setItem('CastleCurDailyChallenge', JSON.stringify(Castle.curDailyChallenge));
        }

        if (d[c].type === 'daily_challenge_counter')
        {
            if (d[c].tasks && d[c].tasks[0] && d[c].tasks[0].currentProgress)
            {
                Castle.curSevenDayChallenge = { id: d[c].id, state: d[c].state, currentProgress: d[c].tasks[0].currentProgress }
            }
        }
    }

    if (Castle.curSevenDayChallenge === undefined)
    {
        Castle.curSevenDayChallenge = { state: 'inactive', currentProgress: 0 };
    }

    Castle.ShowProgressTable();

});

/**
 * 
 * @type {{DailyChallenge: number, curCastlePoints: number, AuctionWinningReward: number, curCastlePointsDiff: number, MaxDailyWinningBattlesReward: number, ShopTradeCoinsDivisor: number, DailyWinningBattlesReward: number, RewardGroups: {Shop: number, Daily: number, Gex: number, AntiqueDealer: number, Challenge: number}, curWinningBattles: undefined, curDailyCastlePoints: undefined, DailyNegotiations: number, curShopItems: undefined, BuildBox: Castle.BuildBox, curDailyChallenge: undefined, curLevel: undefined, startOfDay: *, DailyNegotiationsReward: number, curGexLastOfSection: undefined, SevenDayChallengeReward: number, SettingsSaveValues: Castle.SettingsSaveValues, NextNegotiationPoints: undefined, SevenDayChallenge: number, Settings: {showSummary: boolean, tableView: string, showGroupNames: boolean}, UpdateCastlePoints: Castle.UpdateCastlePoints, ShowProgressTable: Castle.ShowProgressTable, dailyPointsCollectionAvailableAt: undefined, DailyWinningBattles: number, curSevenDayChallenge: undefined, ShopGemstonesDivisor: number, NextWinningBattlesPoints: undefined, DailyChallengeReward: number, CastleSettings: Castle.CastleSettings, MaxDailNegotiationsReward: number, MaxGexLastOfSections: number, curNegotiations: undefined, GexLastOfSectionsIds: number[], CreateRewardList: (function(): *[]), ShowCastlePoints: Castle.ShowCastlePoints, CastleLevelLimits: number[], DailyCastlePoints: number, Show: Castle.Show, WeeklyGexLastOfSection: number, curAuctionWinning: undefined}}
 */
let Castle = {

    AuctionWinningReward: 30,
    CastleLevelLimits: [500, 3000, 7500, 17500, 30000, 50000, 75000, 107600, 151100, 209900, 290000, 399600, 549900, 756200, 1039500],
    DailyCastlePoints: 1,
    DailyChallenge: 1,
    DailyChallengeReward: 100,
    DailyNegotiations: 15,
    DailyNegotiationsReward: 30,
    DailyWinningBattles: 15,
    DailyWinningBattlesReward: 30,
    GexLastOfSectionsIds: [7, 15, 23, 31, 39, 47, 55, 63, 71, 79, 87, 95, 103, 111, 119, 127],
    MaxDailNegotiationsReward: 240,
    MaxDailyWinningBattlesReward: 240,
    MaxGexLastOfSections: 600,
    SevenDayChallenge: 7,
    SevenDayChallengeReward: 700,
    ShopGemstonesDivisor: 2,
    ShopTradeCoinsDivisor: 300,
    WeeklyGexLastOfSection: 16,

    curAuctionWinning: undefined,
    curCastlePoints: 0,
    curCastlePointsDiff: 0,
    curDailyCastlePoints: undefined,
    curDailyChallenge: undefined,
    curGexLastOfSection: undefined,
    curLevel: undefined,
    curNegotiations: undefined,
    curSevenDayChallenge: undefined,
    curShopItems: undefined,
    curWinningBattles: undefined,
    dailyPointsCollectionAvailableAt: undefined,
    NextNegotiationPoints: undefined,
    NextWinningBattlesPoints: undefined,
    RewardGroups: { Daily: 0, Challenge: 1, Gex: 2, AntiqueDealer: 3, Shop: 4 },
    startOfDay: moment(MainParser.getCurrentDateTime()).startOf('day').unix(),

    Settings: {
        showGroupNames: true,
        showSummary: true,
        tableView: 'compact'
    },


    BuildBox: () => {

        if ($('#Castle').length === 0)
        {
            HTML.Box({
                id: 'Castle',
                title: i18n('Boxes.Castle.Title'),
                auto_close: true,
                dragdrop: true,
                resize: false,
                minimize: true,
                settings: 'Castle.CastleSettings()'
            });

            HTML.AddCssFile('castle');
        }
        else
        {
            HTML.CloseOpenBox('Castle');
            return;
        }

        let Settings = JSON.parse(localStorage.getItem('CastleSettings'));

        if (Settings)
        {
            for (let k in Settings)
            {
                if (!Settings.hasOwnProperty(k)) { continue; }
                Castle.Settings[k] = Settings[k];
            }
        }

        Castle.Show();
        Castle.ShowCastlePoints();
        Castle.ShowProgressTable();
    },

    /**
     *
     * @param d
     *
     */
    UpdateCastlePoints: (d = null) => {

        if (ResourceStock.castle_points)
        {
            let increased = ResourceStock.castle_points > Castle.curCastlePoints;
            let diff = 0;

            if (Castle.curCastlePoints && increased)
            {
                Castle.curCastlePointsDiff = ResourceStock.castle_points - Castle.curCastlePoints;
                diff = Castle.curCastlePointsDiff;
            }

            Castle.curCastlePoints = ResourceStock.castle_points;

            if (increased)
            {
                Castle.ShowCastlePoints(diff);
            }
        }

        if (d !== null)
        {

            // Collect daily Castle points (CastleSystemService "requestMethod": "collectDailyPoints")
            if (d.points && d.nextCollectionPoints)
            {
                Castle.curDailyCastlePoints = {
                    points: d.points,
                    nextCollectionPoints: d.nextCollectionPoints,
                    currentStreak: d.currentStreak,
                    maxStreak: d.maxStreak,
                    success: true,
                    collected: moment(MainParser.getCurrentDateTime()).startOf('day').unix()
                }

                localStorage.setItem('CastleCurDailyCastlePoints', JSON.stringify(Castle.curDailyCastlePoints));

            }

            // CastleSystemService "requestMethod": "getOverview"
            if (d.nextCastlePoints)
            {
                let n = d.nextCastlePoints;

                Castle.curLevel = d.level ? d.level : Castle.curLevel;
                Castle.NextWinningBattlesPoints = n.castlePointsWinBattle !== undefined ? n.castlePointsWinBattle : Castle.NextWinningBattlesPoints;
                Castle.NextNegotiationPoints = n.castlePointsWinNegotation !== undefined ? n.castlePointsWinNegotation : Castle.NextNegotiationPoints;
                Castle.curWinningBattles = Castle.NextWinningBattlesPoints < Castle.DailyWinningBattlesReward ? (Castle.NextWinningBattlesPoints / 2) : Castle.DailyWinningBattles;
                Castle.curNegotiations = Castle.NextNegotiationPoints < Castle.DailyNegotiationsReward ? (Castle.NextNegotiationPoints / 2) : Castle.DailyNegotiations;
                Castle.ShopGemstonesDivisor = n.castlePointsItemShopGemstonesDivisor ? n.castlePointsItemShopGemstonesDivisor : Castle.ShopGemstonesDivisor;
                Castle.ShopTradeCoinsDivisor = n.castlePointsItemShopTradeCoinsDivisor ? n.castlePointsItemShopTradeCoinsDivisor : Castle.ShopTradeCoinsDivisor;
                Castle.AuctionWinningReward = n.castlePointsItemAuctionWinBidding ? n.castlePointsItemAuctionWinBidding : 30;
                Castle.startOfDay = moment(MainParser.getCurrentDateTime()).startOf('day').unix();
            }

            if ($('#Castle').length === 1)
            {
                Castle.ShowProgressTable();
            }

        }

    },


    CreateRewardList: () => {
        let d = [];
        let battlePointReward = 0,
            negotiationPointReward = 0,
            dcp = 0, dcr = 0,       //Daily Challenge
            scp = 0, scr = 0,       //Seven Day Challenge
            glsp = 0, glsr = 0,     //Gex Last Sections
            sir = 0, sip = 0, sipsum = 0, sirsum = 0, siwarn = false, //Bought Shop Items
            aup = 0, aur = 0,       //Auction
            cp, cpwarn = false,     //Castle Points
            startOfDay = moment(MainParser.getCurrentDateTime()).startOf('day').unix();

        //Reset values on new day
        if (Castle.startOfDay !== startOfDay)
        {
            Castle.curWinningBattles = Castle.DailyWinningBattles;
            Castle.curNegotiations = Castle.DailyNegotiations;

            Castle.startOfDay = moment(MainParser.getCurrentDateTime()).startOf('day').unix();
        }

        // Daily winning battle reward
        for (let i = Castle.DailyWinningBattlesReward; i > Castle.NextWinningBattlesPoints; i -= 2)
        {
            battlePointReward += i;
        }

        d.push({
            name: i18n('Boxes.Castle.Battles'),
            group: Castle.RewardGroups.Daily,
            sort: 1,
            progress: Castle.DailyWinningBattles - Castle.curWinningBattles,
            maxprogress: Castle.DailyWinningBattles,
            reward: battlePointReward,
            maxreward: Castle.MaxDailyWinningBattlesReward,
            warning: false,
            success: Castle.DailyWinningBattles - Castle.curWinningBattles === Castle.DailyWinningBattles,
            date: startOfDay
        });

        // Daily negotiation reward   
        for (let i = Castle.DailyNegotiationsReward; i > Castle.NextNegotiationPoints; i -= 2)
        {
            negotiationPointReward += i;
        }

        d.push({
            name: i18n('Boxes.Castle.Negotiations'),
            group: Castle.RewardGroups.Daily,
            sort: 2,
            progress: Castle.DailyNegotiations - Castle.curNegotiations,
            maxprogress: Castle.DailyNegotiations,
            reward: negotiationPointReward,
            maxreward: Castle.MaxDailNegotiationsReward,
            warning: false,
            success: Castle.DailyNegotiations - Castle.curNegotiations === Castle.DailyNegotiations,
            date: startOfDay
        });

        // Daily Castle points
        cp = {
            points: '?',
            nextCollectionPoints: '?',
            currentStreak: '?',
            maxStreak: '?',
            success: false,
            collected: startOfDay
        };

        if (Castle.curDailyCastlePoints === undefined)
        {
            Castle.curDailyCastlePoints = JSON.parse(localStorage.getItem('CastleCurDailyCastlePoints'));
        }

        if (Castle.curDailyCastlePoints)
        {
            cp = Castle.curDailyCastlePoints;

            if (cp.success && startOfDay !== cp.collected)
            {
                cp.success = false;
            }

            if (startOfDay !== cp.collected && startOfDay - cp.collected === 86400)
            {
                cp.points = cp.nextCollectionPoints;
            }
        }
        else
        {
            let locDailyPointsCollectionAvailableAt = localStorage.getItem('CastleDailyPointsCollectionAvailableAt');

            if (Castle.dailyPointsCollectionAvailableAt && Castle.dailyPointsCollectionAvailableAt > startOfDay)
            {
                cp.success = true;
            }
            else if (locDailyPointsCollectionAvailableAt && locDailyPointsCollectionAvailableAt > startOfDay)
            {
                cp.success = true;
            }
            else
            {
                cpwarn = true;
            }
        }

        d.push({
            name: i18n('Boxes.Castle.DailyCastlePoints'),
            group: Castle.RewardGroups.Daily,
            sort: 3,
            progress: cp.success ? 1 : 0,
            maxprogress: 1,
            reward: cp.success ? cp.points : 0,
            maxreward: cp.points ? cp.points : '?',
            warning: cpwarn,
            warnnotice: HTML.i18nTooltip(i18n("Boxes.Castle.VisitCastleWarning")),
            success: cp.success,
            date: startOfDay
        });


        // Daily Challenge
        if (Castle.curDailyChallenge === undefined || Castle.curDailyChallenge.state === 'success')
        {
            dcp = 1;
            dcr = Castle.DailyChallengeReward;
        }

        d.push({
            name: i18n('Boxes.Castle.DailyChallenge'),
            group: Castle.RewardGroups.Challenge,
            sort: 1,
            progress: dcp,
            maxprogress: Castle.DailyChallenge,
            reward: dcr,
            maxreward: Castle.DailyChallengeReward,
            warning: false,
            success: dcp === Castle.DailyChallenge,
            date: startOfDay
        });


        // Seven Day Challenge
        scp = Castle.curSevenDayChallenge.currentProgress

        if (scp === 7)
        {
            scr = Castle.SevenDayChallengeReward;
        }

        d.push({
            name: i18n('Boxes.Castle.SevenDayChallenge'),
            group: Castle.RewardGroups.Challenge,
            sort: 2,
            progress: scp,
            maxprogress: Castle.SevenDayChallenge,
            reward: scr,
            maxreward: Castle.SevenDayChallengeReward,
            warning: false,
            success: scp === Castle.SevenDayChallenge,
            date: startOfDay
        });

        // Gex Last of sections
        if (Castle.curGexLastOfSection === undefined)
        {
            Castle.curGexLastOfSection = JSON.parse(localStorage.getItem('CastleCurGexLastOfSection'));
        }

        if (Castle.curGexLastOfSection)
        {
            let i = 0,
                k = 0;
            let progress = Castle.curGexLastOfSection.progress;

            Castle.GexLastOfSectionsIds.forEach(level => {

                if (level <= progress)
                {
                    if (k % 4 === 0)
                    {
                        i += 15;
                    }

                    glsr += i;
                    k++;
                    glsp++;
                }

            });

        }

        d.push({
            name: i18n('Boxes.Castle.GexLastOfSections'),
            group: Castle.RewardGroups.Gex,
            sort: 1,
            progress: glsp,
            maxprogress: Castle.GexLastOfSectionsIds.length,
            reward: glsr,
            maxreward: Castle.MaxGexLastOfSections,
            warning: !Castle.curGexLastOfSection,
            warnnotice: HTML.i18nTooltip(i18n("Boxes.Castle.VisitGexWarning")),
            success: glsp >= Castle.GexLastOfSectionsIds.length,
            date: startOfDay
        });


        // Item Shop
        if (Castle.curShopItems === undefined)
        {
            Castle.curShopItems = JSON.parse(localStorage.getItem('CastleCurShopItems'));
        }

        if (Castle.curShopItems && Castle.curShopItems.date === startOfDay)
        {
            sir = Castle.curShopItems.purchased.reward;
            sirsum = Castle.curShopItems.purchased.reward + Castle.curShopItems.available.reward;
            sip = Castle.curShopItems.purchased.count;
            sipsum = Castle.curShopItems.purchased.count + Castle.curShopItems.available.count;
        }
        else
        {
            sipsum = 6;
            siwarn = true;
        }

        d.push({
            name: i18n('Boxes.Castle.ShopAntiqueDealer'),
            group: Castle.RewardGroups.AntiqueDealer,
            sort: 1,
            progress: sip,
            maxprogress: sipsum,
            reward: sir,
            maxreward: sirsum,
            warning: siwarn,
            warnnotice: HTML.i18nTooltip(i18n('Boxes.Castle.VisitAntiqueDealerWarning')),
            success: sip === sipsum,
            date: startOfDay
        });

        // Won auction bidding
        if (Castle.curAuctionWinning === undefined)
        {
            Castle.curAuctionWinning = JSON.parse(localStorage.getItem('CastleCurAuctionWinning'));
        }

        if (Castle.curAuctionWinning && Castle.curAuctionWinning['date'] && Castle.curAuctionWinning['rewards'] && Castle.curAuctionWinning.date === startOfDay)
        {
            Castle.curAuctionWinning.rewards.forEach(item => {
                aup++;
                aur += item.reward;
            });
        }

        d.push({
            name: i18n('Boxes.Castle.AuctionsWon'),
            group: Castle.RewardGroups.AntiqueDealer,
            sort: 2,
            progress: HTML.Format(aup),
            maxprogress: HTML.Format(aup),
            reward: HTML.Format(aur),
            maxreward: HTML.Format(aur),
            warning: false,
            success: aup > 0,
            date: startOfDay
        });

        return d.sort((a, b) => a.group - b.group || a.sort - b.sort);

    },


    Show: () => {

        let h = [];

        h.push(`<div class="castle_wrapper">`);
        h.push(`<div class="overview dark-bg" id="cas-points-wrapper"></div>`);
        h.push(`<div id="cas-table-wrapper" class="content"></div>`);
        h.push(`</div>`);

        $('#CastleBody').html(h.join(''));


    },

    ShowCastlePoints: (diff = null) => {

        if ($('#Castle #cas-points-wrapper').length === 1)
        {
            $('#Castle #cas-points-wrapper').html(`
                <span>${i18n('Boxes.Castle.CastlePoints')}: ${HTML.Format(Castle.curCastlePoints)} / ${HTML.Format(Castle.CastleLevelLimits[Castle.curLevel])}</span>
                <span id="cas-points-dif">${diff ? '+' + diff : ''}</span>
                <span> ${i18n('Boxes.Castle.Level')}: ${Castle.curLevel}</span>
            `).promise().done(function () {
                $('#cas-points-dif').delay(2500).fadeOut(500);
            });
        }

    },

    ShowProgressTable: () => {

        if ($('#Castle').length === 0) { return; }

        let h = [],
            firstCaption = true,
            list = Castle.CreateRewardList();

        h.push(`<table class="foe-table">`);

        if (!Castle.Settings.showGroupNames)
        {
            h.push(`<thead><tr class="caption"><th>${i18n('Boxes.Castle.Type')}</th><th class="text-right"><span>${HTML.i18nTooltip(i18n('Boxes.Castle.Progress'))}</span></th><th class="text-right"><span>${HTML.i18nTooltip(i18n('Boxes.Castle.CastlePoints'))}</span></th></tr></thead>`);
        }

        h.push(`<tbody>`);

        h.push(list.map((i) => {

            let r = '';

            if (Castle.Settings.showGroupNames && i.sort === 1)
            {
                let GroupName = Object.keys(Castle.RewardGroups).find(k => Castle.RewardGroups[k] === i.group);
                r = r + `<tr class="caption"><td>${i18n('Boxes.Castle.' + GroupName)}</td><td class="text-right"><span>${firstCaption ? i18n('Boxes.Castle.Progress') : ''}</span></td><td class="text-right"><span>${firstCaption ? i18n('Boxes.Castle.CastlePoints') : ''}</span></td></tr>`;
                firstCaption = false;
            }

            let progressStr, rewardStr;

            switch (Castle.Settings.tableView)
            {
                case 'compact':
                    progressStr = i.progress === i.maxprogress ? i.maxprogress : i.progress + ' / ' + i.maxprogress;
                    rewardStr = i.reward === i.maxreward ? i.maxreward : i.reward + ' / ' + i.maxreward;
                    break;

                case 'detail':
                default:
                    progressStr = i.progress + ' / ' + i.maxprogress;
                    rewardStr = i.reward + ' / ' + i.maxreward;
                    break;
            }

            return r + `<tr ${i.warning && i.warnnotice ? ' title="' + i.warnnotice + '" ' : ''}class="${i.warning ? 'warning ' : ''}${i.success ? 'success' : 'pending'}">
                <td>${i.name}</td>
                <td class="text-right">${progressStr}</td>
                <td class="text-right">${rewardStr}</td>
                </tr>`;

        }).join(''));

        h.push(`</tbody></table>`);

        $('#Castle #cas-table-wrapper').html(h.join('')).promise().done(function () {
            $('#CastleBody tr[title], #CastleBody span[title]').tooltip({
                html: false,
                container: '#CastleBody'
            });
        });

    },


    CastleSettings: () => {

        let c = [];
        let Settings = Castle.Settings;
        // c.push(`<p class="text-left">${i18n('Boxes.Castle.TableView')}  <select id="casTableStyle" name="tablestyle">`);
        // c.push(`<option value="detail" ${Settings.tableView === 'detail' ? ' selected="selected"' : ''}>${i18n('Boxes.Castle.Detailed')}</option>`);
        // c.push(`<option value="compact" ${Settings.tableView === 'compact' ? ' selected="selected"' : ''}>${i18n('Boxes.Castle.Compact')}</option>`);
        // c.push(`</select>`);

        c.push(`<p class="text-left"><input id="casShowGroupNames" name="showgroupnames" value="1" type="checkbox" ${Settings.showGroupNames === true ? ' checked="checked"' : ''} /> <label for="casShowGroupNames">${i18n('Boxes.Castle.ShowGroupNames')}</label></p>`);

        c.push(`<hr><p><button id="save-Castle-settings" class="btn btn-default" style="width:100%" onclick="Castle.SettingsSaveValues()">${i18n('Boxes.General.Save')}</button></p>`);
        $('#CastleSettingsBox').html(c.join(''));

    },


    SettingsSaveValues: () => {

        Castle.Settings.showGroupNames = !!$("#casShowGroupNames").is(':checked');
        // Castle.Settings.tableView = $('#casTableStyle').val();

        localStorage.setItem('CastleSettings', JSON.stringify(Castle.Settings));

        $(`#CastleSettingsBox`).fadeToggle('fast', function () {
            $(this).remove();
            Castle.ShowCastlePoints();
            Castle.ShowProgressTable();
        });
    }

}