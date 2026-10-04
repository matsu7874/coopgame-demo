//! 依存している coopgame の版を Cargo.lock から読み、`COOPGAME_VERSION` として埋め込む。
//! 早見図は、この版にない機能に印を付ける。

use std::fs;

fn main() {
    println!("cargo:rerun-if-changed=Cargo.lock");
    let lock = fs::read_to_string("Cargo.lock").expect("Cargo.lock を読めない");
    let version = lock
        .split("[[package]]")
        .find(|block| block.contains("name = \"coopgame\"\n"))
        .and_then(|block| {
            block
                .lines()
                .find_map(|line| line.strip_prefix("version = \"")?.strip_suffix('"'))
        })
        .expect("Cargo.lock に coopgame がない");
    println!("cargo:rustc-env=COOPGAME_VERSION={version}");
}
