#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
cd "${project_root}"

for command_name in node npm cargo rustc; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Error: '${command_name}' is required but was not found in PATH." >&2
    exit 1
  fi
done

package_version="$(node -p "require('./package.json').version")"
tauri_version="$(node -p "require('./src-tauri/tauri.conf.json').version")"

if [[ "${package_version}" != "${tauri_version}" ]]; then
  echo "Error: version mismatch." >&2
  echo "  package.json:              ${package_version}" >&2
  echo "  src-tauri/tauri.conf.json: ${tauri_version}" >&2
  exit 1
fi

case "$(uname -s)" in
  Darwin) platform="macos" ;;
  Linux) platform="linux" ;;
  MINGW*|MSYS*|CYGWIN*) platform="windows" ;;
  *) platform="$(uname -s | tr '[:upper:]' '[:lower:]')" ;;
esac

case "$(uname -m)" in
  x86_64|amd64) architecture="x64" ;;
  arm64|aarch64) architecture="arm64" ;;
  *) architecture="$(uname -m)" ;;
esac

bundle_root="${project_root}/src-tauri/target/release/bundle"

cleanup_stale_dmg_mounts() {
  [[ "${platform}" == "macos" ]] || return 0
  command -v hdiutil >/dev/null 2>&1 || return 0

  while IFS= read -r device; do
    [[ -n "${device}" ]] || continue
    echo "Detaching stale release disk image ${device}..."
    hdiutil detach "${device}" >/dev/null 2>&1 ||
      hdiutil detach -force "${device}" >/dev/null
  done < <(
    hdiutil info | awk -v image_prefix="${bundle_root}/macos/rw." '
      /^image-path/ { release_image = index($0, image_prefix) > 0 }
      release_image && $1 ~ /^\/dev\/disk[0-9]+$/ {
        print $1
        release_image = 0
      }
    '
  )
}

echo "Building MyCoach v${package_version} for ${platform}-${architecture}..."
echo "Installing locked frontend dependencies..."
npm ci

cleanup_stale_dmg_mounts
if [[ -d "${bundle_root}" ]]; then
  echo "Removing artifacts from the previous bundle..."
  rm -rf "${bundle_root}"
fi

echo "Running the production Tauri build..."
set +e
npm run tauri build
tauri_status=$?
set -e

cleanup_stale_dmg_mounts

if [[ ! -d "${bundle_root}" ]]; then
  echo "Error: Tauri did not create ${bundle_root}." >&2
  exit 1
fi

build_stamp="$(date '+%Y%m%d-%H%M%S')"
release_dir="${project_root}/release/MyCoach-v${package_version}-${platform}-${architecture}-${build_stamp}"
mkdir -p "${release_dir}"

artifact_count=0
while IFS= read -r -d '' artifact; do
  cp -R "${artifact}" "${release_dir}/"
  artifact_count=$((artifact_count + 1))
done < <(
  find "${bundle_root}" -mindepth 2 -maxdepth 2 \
    \( \
      \( -type d -name '*.app' \) -o \
      \( -type f \( \
        -name '*.dmg' -o \
        -name '*.pkg' -o \
        -name '*.AppImage' -o \
        -name '*.deb' -o \
        -name '*.rpm' -o \
        -name '*.msi' -o \
        -name '*.exe' \
      \) ! -name 'rw.*.dmg' \) \
    \) -print0
)

if [[ "${artifact_count}" -eq 0 ]]; then
  echo "Error: no release artifacts were found in ${bundle_root}." >&2
  if [[ "${tauri_status}" -ne 0 ]]; then
    exit "${tauri_status}"
  fi
  exit 1
fi

if [[ "${tauri_status}" -ne 0 ]]; then
  echo "Warning: one Tauri bundle format failed, but ${artifact_count} valid artifact(s) were produced." >&2
fi

if command -v shasum >/dev/null 2>&1; then
  (
    cd "${release_dir}"
    while IFS= read -r artifact; do
      shasum -a 256 "${artifact}"
    done < <(find . -type f ! -name SHA256SUMS | LC_ALL=C sort)
  ) > "${release_dir}/SHA256SUMS"
elif command -v sha256sum >/dev/null 2>&1; then
  (
    cd "${release_dir}"
    while IFS= read -r artifact; do
      sha256sum "${artifact}"
    done < <(find . -type f ! -name SHA256SUMS | LC_ALL=C sort)
  ) > "${release_dir}/SHA256SUMS"
else
  echo "Warning: no SHA-256 tool found; skipping checksums." >&2
fi

echo
echo "Release build complete:"
echo "  ${release_dir}"
echo
echo "Artifacts:"
find "${release_dir}" -mindepth 1 -maxdepth 2 -print | sed "s#^${project_root}/#  #"
