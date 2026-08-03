use rand::Rng;
use serde_json::Value;

pub struct SpintaxResolver;

impl SpintaxResolver {
    /// Resolves spintax patterns (e.g. `{hi|hello}`) and interpolates recipient custom variables (`{{var}}` or `{var}`).
    pub fn resolve(template: &str, custom_vars: Option<&Value>) -> String {
        let text_after_spintax = Self::parse_spintax(template);
        Self::interpolate_variables(&text_after_spintax, custom_vars)
    }

    /// Recursively parses nested `{option1|option2|...}` spintax blocks.
    pub fn parse_spintax(input: &str) -> String {
        let mut result = input.to_string();

        while let Some(close_idx) = result.find('}') {
            if let Some(open_idx) = result[..close_idx].rfind('{') {
                let inner = &result[open_idx + 1..close_idx];
                // Check if this brace group is spintax (contains '|')
                if inner.contains('|') {
                    let options: Vec<&str> = inner.split('|').collect();
                    let mut rng = rand::thread_rng();
                    let choice_idx = rng.gen_range(0..options.len());
                    let chosen = options[choice_idx];

                    let mut new_result = String::with_capacity(result.len());
                    new_result.push_str(&result[..open_idx]);
                    new_result.push_str(chosen);
                    new_result.push_str(&result[close_idx + 1..]);
                    result = new_result;
                } else {
                    // Mark variable braces temporarily or skip if it's a variable reference
                    // To avoid infinite loops on non-spintax braces like {{var}} or {var},
                    // if inner doesn't contain '|', we mask this pair to continue finding spintax choices.
                    // Instead of an infinite loop, we search for spintax using a loop that checks if any `{...|...}` exists.
                    break;
                }
            } else {
                break;
            }
        }

        // Robust spintax loop that specifically looks for `{...}` containing `|`
        let mut text = result;
        loop {
            // Find an innermost `{...}` block that contains `|`
            let mut found_spintax = false;
            let mut close_pos = None;
            for (i, ch) in text.char_indices() {
                if ch == '}' {
                    close_pos = Some(i);
                    break;
                }
            }

            if let Some(close_idx) = close_pos {
                if let Some(open_idx) = text[..close_idx].rfind('{') {
                    let inner = &text[open_idx + 1..close_idx];
                    if inner.contains('|') {
                        let options: Vec<&str> = inner.split('|').collect();
                        let mut rng = rand::thread_rng();
                        let choice_idx = rng.gen_range(0..options.len());
                        let chosen = options[choice_idx];

                        let mut new_text = String::with_capacity(text.len());
                        new_text.push_str(&text[..open_idx]);
                        new_text.push_str(chosen);
                        new_text.push_str(&text[close_idx + 1..]);
                        text = new_text;
                        found_spintax = true;
                    } else {
                        // Temporarily replace non-spintax '{' and '}' so we can find other spintax choices
                        let mut masked_text = String::with_capacity(text.len());
                        masked_text.push_str(&text[..open_idx]);
                        masked_text.push('\u{E000}'); // private use char for {
                        masked_text.push_str(inner);
                        masked_text.push('\u{E001}'); // private use char for }
                        masked_text.push_str(&text[close_idx + 1..]);
                        text = masked_text;
                        found_spintax = true;
                    }
                }
            }

            if !found_spintax {
                break;
            }
        }

        // Unmask temporary non-spintax braces
        text = text.replace('\u{E000}', "{").replace('\u{E001}', "}");
        text
    }

    /// Interpolates `{{var}}` or `{var}` variables from JSON custom variables map.
    pub fn interpolate_variables(input: &str, custom_vars: Option<&Value>) -> String {
        let mut result = input.to_string();
        let empty_map = serde_json::Map::new();
        let vars_map = custom_vars.and_then(|v| v.as_object()).unwrap_or(&empty_map);

        for (k, v) in vars_map {
            let val_str = match v {
                Value::String(s) => s.clone(),
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                _ => v.to_string(),
            };

            // Replace {{key}}
            let pattern_double = format!("{{{{{}}}}}", k);
            result = result.replace(&pattern_double, &val_str);

            // Replace {key}
            let pattern_single = format!("{{{}}}", k);
            result = result.replace(&pattern_single, &val_str);
        }

        // Clear any remaining un-interpolated {{var}} or {var} placeholders
        // (Only clear if they look like simple variable identifiers)
        let mut cleaned = String::new();
        let mut chars = result.chars().peekable();
        while let Some(ch) = chars.next() {
            if ch == '{' {
                // Check if double brace {{...}}
                if chars.peek() == Some(&'{') {
                    chars.next(); // consume second {
                    let mut var_name = String::new();
                    let mut closed = false;
                    while let Some(&c) = chars.peek() {
                        if c == '}' {
                            chars.next();
                            if chars.peek() == Some(&'}') {
                                chars.next();
                                closed = true;
                                break;
                            }
                        } else {
                            var_name.push(c);
                            chars.next();
                        }
                    }
                    if !closed {
                        cleaned.push_str("{{");
                        cleaned.push_str(&var_name);
                    }
                } else {
                    let mut var_name = String::new();
                    let mut closed = false;
                    while let Some(&c) = chars.peek() {
                        if c == '}' {
                            chars.next();
                            closed = true;
                            break;
                        } else if c.is_alphanumeric() || c == '_' || c == '-' {
                            var_name.push(c);
                            chars.next();
                        } else {
                            break;
                        }
                    }
                    if !closed {
                        cleaned.push('{');
                        cleaned.push_str(&var_name);
                    }
                }
            } else {
                cleaned.push(ch);
            }
        }

        cleaned
    }
}
