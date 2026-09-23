/** Shared by the pre-game briefing and the in-game rules reminder. */
export interface GameGuide {
  goal: string;
  controls: string;
  scoring: string;
}

export const GAME_GUIDES: Record<string, GameGuide> = {
  bombcountdown: {
    goal: "在炸彈爆炸前答對，把它傳出去！",
    controls: "拿到炸彈時看手機題目並點答案；其他人看大螢幕。答對不會重置引信。",
    scoring: "答對 +10；答錯引信扣 1 秒。每局最後倖存者 +50，下局全員回歸。",
  },
  drawandguess: {
    goal: "輪流當畫家，讓大家猜出你的秘密詞。",
    controls: "畫家在手機畫布作畫；其他人在手機輸入答案。猜中後請保密，讓其他人繼續猜！",
    scoring: "猜中 +10–25，越快越高；每有人猜中，畫家 +5。每輪每人各畫一次。",
  },
  everybodyknows: {
    goal: "猜猜大家會選誰，和全場想在一起！",
    controls: "看題目，在手機選一位玩家。送出後等待揭曉，不會公開你的選票。",
    scoring: "投中最多票的人 +10；若最高票並列，選中其中一位也算。",
  },
  aibullshit: {
    goal: "編出可信的假答案，騙過朋友。",
    controls: "先輸入假答案，再從混合選項中找出真答案。不能投自己的假答案。",
    scoring: "選中真答案 +10；每騙到一位玩家，假答案作者 +5。",
  },
  whoisundercoveragent: {
    goal: "平民找出臥底；臥底隱藏身分撐到最後。",
    controls: "私下看手機詞彙，輪流口頭描述但別直接說出詞。討論後在手機投票。",
    scoring: "依陣營勝負結算：平民勝利各 +20；臥底勝利 +50。平票不淘汰。",
  },
  song3seconds: {
    goal: "從逐步揭露的歌詞猜出歌名。",
    controls: "先看大螢幕的歌詞提示，再在手機選歌名。本模式是看歌詞猜歌，不播放歌曲。",
    scoring: "答對 +10，快速答對有額外加分；送出後等待答案揭曉。",
  },
  kingtonight: {
    goal: "贏下每回合的小挑戰，爭奪今晚王位。",
    controls: "先看本回合指示，再依挑戰連點、反應點擊或猜數字。",
    scoring: "每回合挑戰獲勝者 +25；累積總分決定排名。",
  },
  fireworkmaster: {
    goal: "設計最受歡迎的煙火，讓全場驚豔。",
    controls: "在手機選顏色、形狀和特效並送出。欣賞大螢幕煙火秀，再投給喜歡的作品。",
    scoring: "作品每得到一票 +15。",
  },
  realbattle: {
    goal: "在倒數結束前收集最多寶物。",
    controls: "手機方向鍵移動，大螢幕看位置；撞到別人會把對方推開。",
    scoring: "金幣 +2、星星 +5、巨星 +10。分數最高者獲勝。",
  },
  mysteryroom: {
    goal: "一起解開四位密碼，在時間內逃出密室。",
    controls: "讀出你手機上的線索，和朋友討論，再輸入密碼。可花時間換提示。",
    scoring: "逃脫成功全員 +20，解鎖者額外 +15。輸錯扣 3 秒，每次提示扣 10 秒。",
  },
  musicalchairs: {
    goal: "音樂停下才搶座，撐到最後！",
    controls: "注意大螢幕，出現搶座提示時點手機座位按鈕。出局後觀戰，下場再來。",
    scoring: "成功晉級 +10，最後勝出 +50；最慢的玩家本場淘汰。",
  },
  whackmoles: {
    goal: "比別人更快打中冒出的地鼠。",
    controls: "看九宮格，點有地鼠的格子；同一隻只有第一個打中的人得分。",
    scoring: "命中 +1，連擊有額外加分；打空會中斷連擊。",
  },
  simonsays: {
    goal: "記住顏色順序，挑戰更長的序列。",
    controls: "先看大螢幕示範，輪到重複時在手機照順序點。點錯本輪出局。",
    scoring: "完整答對序列，得到等同序列長度的分數；完成最高難度另有獎勵。",
  },
  wordchain: {
    goal: "用上一個詞的最後一字接出新詞。",
    controls: "輸入 2–4 個中文字，不可重複。可接待確認詞的尾字；若有疑問，確認前按異議並投票。",
    scoring: "有效接詞 +10；成功異議者各 +5，被推翻者 -5（最低 0）。平票保留原詞。",
  },
  pokerlite: {
    goal: "用手牌、公共牌和下注策略，累積最多籌碼。",
    controls: "輪到你才可棄牌、過牌、跟注或加注。逾時面對下注會棄牌，無需跟注則過牌。",
    scoring: "每人 100 籌碼，大盲 2／小盲 1。贏家分配底鍋；籌碼用完，下局補 50 繼續。",
  },
};
