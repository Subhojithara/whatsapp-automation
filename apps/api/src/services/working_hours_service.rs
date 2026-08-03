use chrono::{DateTime, Duration, LocalResult, NaiveTime, TimeZone, Timelike, Utc};
use chrono_tz::Tz;

pub struct WorkingHoursService;

impl WorkingHoursService {
    /// Returns true if the current time in `timezone_str` falls within `start_hhmm` and `end_hhmm`.
    pub fn is_within_working_hours(
        start_hhmm: &str,
        end_hhmm: &str,
        timezone_str: &str,
    ) -> bool {
        let tz: Tz = timezone_str.parse().unwrap_or(chrono_tz::UTC);
        let now_utc = Utc::now();
        let now_local = now_utc.with_timezone(&tz);
        let now_time = NaiveTime::from_hms_opt(
            now_local.hour(),
            now_local.minute(),
            now_local.second(),
        )
        .unwrap_or_default();

        let start_time = NaiveTime::parse_from_str(start_hhmm, "%H:%M")
            .unwrap_or_else(|_| NaiveTime::from_hms_opt(9, 0, 0).unwrap());
        let end_time = NaiveTime::parse_from_str(end_hhmm, "%H:%M")
            .unwrap_or_else(|_| NaiveTime::from_hms_opt(18, 0, 0).unwrap());

        if start_time <= end_time {
            now_time >= start_time && now_time < end_time
        } else {
            // Overnight / wrap-around window (e.g. 22:00 to 06:00)
            now_time >= start_time || now_time < end_time
        }
    }

    /// Calculates the next UTC DateTime when working hours start.
    pub fn calculate_next_working_window_utc(
        start_hhmm: &str,
        timezone_str: &str,
    ) -> DateTime<Utc> {
        let tz: Tz = timezone_str.parse().unwrap_or(chrono_tz::UTC);
        let now_utc = Utc::now();
        let now_local = now_utc.with_timezone(&tz);

        let start_time = NaiveTime::parse_from_str(start_hhmm, "%H:%M")
            .unwrap_or_else(|_| NaiveTime::from_hms_opt(9, 0, 0).unwrap());

        let mut target_date = now_local.date_naive();
        if now_local.time() >= start_time {
            target_date += Duration::days(1);
        }

        let target_naive = target_date.and_time(start_time);
        match tz.from_local_datetime(&target_naive) {
            LocalResult::Single(dt) => dt.with_timezone(&Utc),
            LocalResult::Ambiguous(dt, _) => dt.with_timezone(&Utc),
            LocalResult::None => target_naive.and_utc(),
        }
    }
}

