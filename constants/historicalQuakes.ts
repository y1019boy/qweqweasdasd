import { P2PQuakeData, JMASeismicIntensity } from '../types';

export const HISTORICAL_QUAKES: P2PQuakeData[] = [
  {
    _id: "jma_20240101",
    code: 551,
    time: "2024-01-01T16:10:00+09:00",
    issue: { time: "2024-01-01T16:10:00+09:00", type: "Historical" },
    earthquake: {
      time: "2024-01-01T16:10:00+09:00",
      hypocenter: {
        name: "石川県能登地方（令和6年能登半島地震）",
        latitude: 37.5,
        longitude: 137.3,
        depth: 16,
        magnitude: 7.6
      },
      maxScale: JMASeismicIntensity.Scale70,
      domesticTsunami: "MajorWarning"
    },
    points: []
  },
  {
    _id: "jma_20180906",
    code: 551,
    time: "2018-09-06T03:07:00+09:00",
    issue: { time: "2018-09-06T03:07:00+09:00", type: "Historical" },
    earthquake: {
      time: "2018-09-06T03:07:00+09:00",
      hypocenter: {
        name: "北海道胆振地方中東部（平成30年北海道胆振東部地震）",
        latitude: 42.7,
        longitude: 142.0,
        depth: 37,
        magnitude: 6.7
      },
      maxScale: JMASeismicIntensity.Scale70,
      domesticTsunami: "None"
    },
    points: []
  },
  {
    _id: "jma_20160416",
    code: 551,
    time: "2016-04-16T01:25:00+09:00",
    issue: { time: "2016-04-16T01:25:00+09:00", type: "Historical" },
    earthquake: {
      time: "2016-04-16T01:25:00+09:00",
      hypocenter: {
        name: "熊本県熊本地方（平成28年熊本地震 本震）",
        latitude: 32.8,
        longitude: 130.8,
        depth: 12,
        magnitude: 7.3
      },
      maxScale: JMASeismicIntensity.Scale70,
      domesticTsunami: "Warning"
    },
    points: []
  },
  {
    _id: "jma_20110311",
    code: 551,
    time: "2011-03-11T14:46:00+09:00",
    issue: { time: "2011-03-11T14:46:00+09:00", type: "Historical" },
    earthquake: {
      time: "2011-03-11T14:46:00+09:00",
      hypocenter: {
        name: "三陸沖（平成23年東北地方太平洋沖地震）",
        latitude: 38.1,
        longitude: 142.9,
        depth: 24,
        magnitude: 9.0
      },
      maxScale: JMASeismicIntensity.Scale70,
      domesticTsunami: "MajorWarning"
    },
    points: []
  },
  {
    _id: "jma_20041023",
    code: 551,
    time: "2004-10-23T17:56:00+09:00",
    issue: { time: "2004-10-23T17:56:00+09:00", type: "Historical" },
    earthquake: {
      time: "2004-10-23T17:56:00+09:00",
      hypocenter: {
        name: "新潟県中越地方（平成16年新潟県中越地震）",
        latitude: 37.3,
        longitude: 138.9,
        depth: 13,
        magnitude: 6.8
      },
      maxScale: JMASeismicIntensity.Scale70,
      domesticTsunami: "None"
    },
    points: []
  },
  {
    _id: "jma_19950117",
    code: 551,
    time: "1995-01-17T05:46:00+09:00",
    issue: { time: "1995-01-17T05:46:00+09:00", type: "Historical" },
    earthquake: {
      time: "1995-01-17T05:46:00+09:00",
      hypocenter: {
        name: "大阪湾（淡路島北東岸）（平成7年兵庫県南部地震）",
        latitude: 34.6,
        longitude: 135.0,
        depth: 16,
        magnitude: 7.3
      },
      maxScale: JMASeismicIntensity.Scale70,
      domesticTsunami: "None"
    },
    points: []
  },
  {
    _id: "jma_19480628",
    code: 551,
    time: "1948-06-28T16:13:00+09:00",
    issue: { time: "1948-06-28T16:13:00+09:00", type: "Historical" },
    earthquake: {
      time: "1948-06-28T16:13:00+09:00",
      hypocenter: {
        name: "福井県嶺北（福井地震）",
        latitude: 36.2,
        longitude: 136.2,
        depth: 0,
        magnitude: 7.1
      },
      maxScale: JMASeismicIntensity.Scale60, // 震度7導入の契機（当時は震度6）
      domesticTsunami: "None"
    },
    points: []
  },
  {
    _id: "jma_19461221",
    code: 551,
    time: "1946-12-21T04:19:00+09:00",
    issue: { time: "1946-12-21T04:19:00+09:00", type: "Historical" },
    earthquake: {
      time: "1946-12-21T04:19:00+09:00",
      hypocenter: {
        name: "和歌山県南方沖（昭和南海地震）",
        latitude: 33.0,
        longitude: 135.6,
        depth: 24,
        magnitude: 8.0
      },
      maxScale: JMASeismicIntensity.Scale60, // 震度6（当時の最大）
      domesticTsunami: "MajorWarning"
    },
    points: []
  },
  {
    _id: "jma_19441207",
    code: 551,
    time: "1944-12-07T13:35:00+09:00",
    issue: { time: "1944-12-07T13:35:00+09:00", type: "Historical" },
    earthquake: {
      time: "1944-12-07T13:35:00+09:00",
      hypocenter: {
        name: "三重県南東沖（昭和東南海地震）",
        latitude: 33.6,
        longitude: 136.2,
        depth: 40,
        magnitude: 7.9
      },
      maxScale: JMASeismicIntensity.Scale60, // 震度6
      domesticTsunami: "MajorWarning"
    },
    points: []
  },
  {
    _id: "jma_19230901",
    code: 551,
    time: "1923-09-01T11:58:00+09:00",
    issue: { time: "1923-09-01T11:58:00+09:00", type: "Historical" },
    earthquake: {
      time: "1923-09-01T11:58:00+09:00",
      hypocenter: {
        name: "神奈川県西部（大正関東地震／関東大震災）",
        latitude: 35.3,
        longitude: 139.1,
        depth: 23,
        magnitude: 7.9
      },
      maxScale: JMASeismicIntensity.Scale70, // 震度7相当
      domesticTsunami: "MajorWarning"
    },
    points: []
  }
];