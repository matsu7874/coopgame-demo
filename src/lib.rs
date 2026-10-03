//! coopgame をブラウザから呼ぶための薄い層。
//!
//! 各関数はデモの 1 画面に対応し、計算結果を JSON の文字列で返す。
//! 計算に失敗した項目は `{"error": "..."}` にして返し、画面の側で表示する。

use coopgame::kernel_set::{SetOptions, kernel_set};
use coopgame::oracle::airport::AirportGame;
use coopgame::oracle::bankruptcy::BankruptcyGame;
use coopgame::oracle::spanning_tree::SpanningTreeGame;
use coopgame::oracle::voting::WeightedVotingGame;
use coopgame::oracle::{self, tabulate};
use coopgame::{Coalition, Domain, ExplicitGame, bankruptcy as rules, nucleolus, plot, properties, values};
use serde_json::{Value, json};
use wasm_bindgen::prelude::*;

fn error(message: impl ToString) -> Value {
    json!({ "error": message.to_string() })
}

fn result_or_error<T: Into<Value>>(result: coopgame::Result<T>) -> Value {
    match result {
        Ok(value) => value.into(),
        Err(e) => error(e),
    }
}

/// 3 人ゲーム (ビット順、空提携を除く 7 個の値) のコア・仁・Shapley 値・カーネル。
pub fn triangle(values: &[f64]) -> Value {
    let game = match ExplicitGame::from_binary(values) {
        Ok(game) => game,
        Err(e) => return error(e),
    };
    let least_core = nucleolus::least_core(&game, Domain::Preimputation);
    // カーネルは多面体の和集合。3 人では点か線分なので、頂点の列で返す。
    let kernel = kernel_set(&game, Domain::Imputation, SetOptions::for_game(&game))
        .map(|set| set.merge_collinear_segments(1e-9))
        .map(|set| {
            set.pieces
                .into_iter()
                .map(|piece| piece.vertices.unwrap_or_else(|| vec![piece.point]))
                .collect::<Vec<_>>()
        });
    json!({
        "nucleolus": result_or_error(nucleolus::nucleolus(&game).map(|r| json!(r.allocation))),
        "prenucleolus": result_or_error(nucleolus::prenucleolus(&game).map(|r| json!(r.allocation))),
        "shapley": values::shapley(&game),
        "least_core": result_or_error(least_core.map(|l| json!({ "epsilon": l.epsilon, "allocation": l.allocation }))),
        "core_vertices": plot::core_vertices(&game),
        "kernel": result_or_error(kernel.map(|k| json!(k))),
        "convex": properties::is_convex(&game),
        "superadditive": properties::is_superadditive(&game),
    })
}

/// 破産問題 (遺産 `estate`、請求 `claims`) の配分規則と、破産ゲームを LP で解いた仁。
pub fn bankruptcy(estate: f64, claims: &[f64]) -> Value {
    let game = match BankruptcyGame::new(estate, claims.to_vec()) {
        Ok(game) => game,
        Err(e) => return error(e),
    };
    let explicit = match tabulate(&game) {
        Ok(explicit) => explicit,
        Err(e) => return error(e),
    };
    let total: f64 = claims.iter().sum();
    let proportional: Vec<f64> = claims
        .iter()
        .map(|d| if total > 0.0 { estate * d / total } else { 0.0 })
        .collect();
    json!({
        "talmud": result_or_error(rules::talmud_rule(estate, claims).map(|x| json!(x))),
        "lp_nucleolus": result_or_error(nucleolus::nucleolus(&explicit).map(|r| json!(r.allocation))),
        "cea": result_or_error(rules::constrained_equal_awards(estate, claims).map(|x| json!(x))),
        "cel": result_or_error(rules::constrained_equal_losses(estate, claims).map(|x| json!(x))),
        "proportional": proportional,
        "shapley": values::shapley(&explicit),
    })
}

/// 重み付き投票ゲーム (重み `weights`、可決に必要な重み `quota`) の投票力。
pub fn voting(weights: &[u32], quota: u32) -> Value {
    let weights: Vec<u64> = weights.iter().map(|&w| u64::from(w)).collect();
    let game = match WeightedVotingGame::new(weights.clone(), u64::from(quota)) {
        Ok(game) => game,
        Err(e) => return error(e),
    };
    let explicit = match tabulate(&game) {
        Ok(explicit) => explicit,
        Err(e) => return error(e),
    };
    let n = weights.len();
    let wins = |mask: u64| explicit.value(Coalition(mask)) > 0.5;
    // 最小勝利提携: 勝つが、誰が抜けても負ける提携。
    let minimal_winning: Vec<u64> = (1..1u64 << n)
        .filter(|&s| wins(s) && (0..n).all(|i| s >> i & 1 == 0 || !wins(s & !(1 << i))))
        .collect();
    // 決定票を持つ回数: 勝利提携から i が抜けると負ける提携の数。
    let swings: Vec<u64> = (0..n)
        .map(|i| {
            (1..1u64 << n)
                .filter(|&s| s >> i & 1 == 1 && wins(s) && !wins(s & !(1 << i)))
                .count() as u64
        })
        .collect();
    json!({
        "shapley_shubik": values::shapley(&explicit),
        "banzhaf": values::normalize(&values::banzhaf(&explicit)),
        "nucleolus": result_or_error(oracle::nucleolus::nucleolus(&game).map(|r| json!(r.allocation))),
        "swings": swings,
        "minimal_winning": minimal_winning,
        "grand_wins": wins((1u64 << n) - 1),
    })
}

/// 最小全域木ゲーム。点 0 が供給元、点 `i + 1` がプレイヤー `i`。辺の費用はユークリッド距離。
pub fn spanning_tree(xs: &[f64], ys: &[f64]) -> Value {
    let size = xs.len().min(ys.len());
    let costs: Vec<Vec<f64>> = (0..size)
        .map(|u| (0..size).map(|v| (xs[u] - xs[v]).hypot(ys[u] - ys[v])).collect())
        .collect();
    let game = match SpanningTreeGame::new(costs.clone()) {
        Ok(game) => game,
        Err(e) => return error(e),
    };
    let savings = match tabulate(&game) {
        Ok(savings) => savings,
        Err(e) => return error(e),
    };
    let standalone: Vec<f64> = costs[0][1..].to_vec();
    let to_costs = |s: &[f64]| -> Vec<f64> { standalone.iter().zip(s).map(|(c, s)| c - s).collect() };
    let to_savings = |c: &[f64]| -> Vec<f64> { standalone.iter().zip(c).map(|(a, c)| a - c).collect() };
    let in_core = |c: &[f64]| properties::is_in_core(&savings, &to_savings(c), 1e-6);

    let bird = game.bird_rule();
    let shapley = to_costs(&values::shapley(&savings));
    let nucleolus = game.nucleolus_costs();
    let total = coopgame::oracle::PlayerSet::full(size - 1);
    json!({
        "edges": mst_edges(&costs),
        "total": game.cost(&total),
        "standalone": standalone,
        "bird": { "costs": bird, "in_core": in_core(&bird) },
        "shapley": { "costs": shapley, "in_core": in_core(&shapley) },
        "nucleolus": match nucleolus {
            Ok(c) => json!({ "costs": c, "in_core": in_core(&c) }),
            Err(e) => error(e),
        },
    })
}

/// 全頂点の最小全域木の辺 (Prim 法、頂点 0 から)。
fn mst_edges(costs: &[Vec<f64>]) -> Vec<[usize; 2]> {
    let size = costs.len();
    let mut in_tree = vec![false; size];
    let mut best: Vec<(f64, usize)> = (0..size).map(|v| (costs[0][v], 0)).collect();
    in_tree[0] = true;
    let mut edges = Vec::new();
    for _ in 1..size {
        let Some(v) = (0..size)
            .filter(|&v| !in_tree[v])
            .min_by(|&a, &b| best[a].0.total_cmp(&best[b].0))
        else {
            break;
        };
        in_tree[v] = true;
        edges.push([best[v].1, v]);
        for u in 0..size {
            if !in_tree[u] && costs[v][u] < best[u].0 {
                best[u] = (costs[v][u], v);
            }
        }
    }
    edges
}

/// 空港ゲーム (各人が必要とする施設の費用 `costs`) の費用の分担。
pub fn airport(costs: &[f64]) -> Value {
    let game = match AirportGame::new(costs.to_vec()) {
        Ok(game) => game,
        Err(e) => return error(e),
    };
    json!({
        "shapley": game.shapley_costs(),
        "nucleolus": result_or_error(game.nucleolus_costs().map(|x| json!(x))),
    })
}

#[wasm_bindgen(js_name = triangle)]
pub fn triangle_js(values: Vec<f64>) -> String {
    triangle(&values).to_string()
}

#[wasm_bindgen(js_name = bankruptcy)]
pub fn bankruptcy_js(estate: f64, claims: Vec<f64>) -> String {
    bankruptcy(estate, &claims).to_string()
}

#[wasm_bindgen(js_name = voting)]
pub fn voting_js(weights: Vec<u32>, quota: u32) -> String {
    voting(&weights, quota).to_string()
}

#[wasm_bindgen(js_name = spanningTree)]
pub fn spanning_tree_js(xs: Vec<f64>, ys: Vec<f64>) -> String {
    spanning_tree(&xs, &ys).to_string()
}

#[wasm_bindgen(js_name = airport)]
pub fn airport_js(costs: Vec<f64>) -> String {
    airport(&costs).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vector(value: &Value) -> Vec<f64> {
        serde_json::from_value(value.clone()).unwrap()
    }

    fn close(a: &[f64], b: &[f64]) -> bool {
        a.len() == b.len() && a.iter().zip(b).all(|(x, y)| (x - y).abs() < 1e-6)
    }

    #[test]
    fn triangle_symmetric_game() {
        let out = triangle(&[0.0, 0.0, 60.0, 0.0, 60.0, 60.0, 90.0]);
        assert!(close(&vector(&out["nucleolus"]), &[30.0, 30.0, 30.0]));
        assert!(close(&vector(&out["shapley"]), &[30.0, 30.0, 30.0]));
        assert!(out["kernel"].is_array());
    }

    #[test]
    fn talmud_matches_lp_nucleolus() {
        // タルムードの例: 遺産 200、請求 100・200・300 → 50, 75, 75。
        let out = bankruptcy(200.0, &[100.0, 200.0, 300.0]);
        assert!(close(&vector(&out["talmud"]), &[50.0, 75.0, 75.0]));
        assert!(close(&vector(&out["lp_nucleolus"]), &[50.0, 75.0, 75.0]));
    }

    #[test]
    fn voting_dummy_player_has_no_power() {
        // EEC 閣僚理事会 (1958): 重み 4,4,4,2,2,1、基準 12。ルクセンブルクの力は 0。
        let out = voting(&[4, 4, 4, 2, 2, 1], 12);
        let ss = vector(&out["shapley_shubik"]);
        assert!(ss[5].abs() < 1e-12);
        assert!(close(&ss[..3], &[7.0 / 30.0; 3]));
        assert_eq!(out["swings"][5], json!(0));
    }

    #[test]
    fn spanning_tree_bird_is_in_core() {
        let out = spanning_tree(&[0.0, 1.0, 2.0, 0.0], &[0.0, 0.0, 0.0, 2.0]);
        assert_eq!(out["bird"]["in_core"], json!(true));
        assert_eq!(out["edges"].as_array().unwrap().len(), 3);
        let bird = vector(&out["bird"]["costs"]);
        assert!((bird.iter().sum::<f64>() - out["total"].as_f64().unwrap()).abs() < 1e-9);
        assert!(out["nucleolus"]["in_core"].as_bool().unwrap());
    }

    #[test]
    fn airport_shapley_littlechild_owen() {
        let out = airport(&[1.0, 2.0, 4.0]);
        assert!(close(&vector(&out["shapley"]), &[1.0 / 3.0, 1.0 / 3.0 + 0.5, 1.0 / 3.0 + 0.5 + 2.0]));
    }
}
