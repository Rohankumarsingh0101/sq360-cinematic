/**
 * SQ360 Cinematic Scroll Experience
 * ═══════════════════════════════════════════════════════════════
 *  Fixed stage × Lenis (desktop) × native swipe (mobile)
 *  All-intra 24fps films, frame-quantized currentTime, no pin
 * ═══════════════════════════════════════════════════════════════
 */

import './style.css'
import Lenis from '@studio-freight/lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)
ScrollTrigger.config({ ignoreMobileResize: true })

const $loader       = document.querySelector('#loader')
const $loaderFill   = document.querySelector('.loader-fill')
const $videoDesktop = document.querySelector('#video-desktop')
const $videoMobile  = document.querySelector('#video-mobile')
const $dissolve     = document.querySelector('#scene-dissolve')
const $endSlate     = document.querySelector('#end-slate')
const $cards        = document.querySelectorAll('.cost-card')
const $dots         = document.querySelectorAll('.dot')
const $bhFill       = document.querySelector('#bh-fill')
const $bhPct        = document.querySelector('#bh-progress-pct')
const $bhHint       = document.querySelector('#bh-scroll-hint')
const $tbLabel      = document.querySelector('#tb-section-label')
const $ambience     = document.querySelector('#video-ambience')

const mqPhone = window.matchMedia('(max-width: 768px), (max-aspect-ratio: 3/4)')
const isMobile = () => mqPhone.matches
const activeVideo = () => (isMobile() ? $videoMobile : $videoDesktop)

;[ $videoDesktop, $videoMobile ].forEach((v) => {
  v.playsInline = true
  v.muted = true
  v.controls = false
  v.disablePictureInPicture = true
  v.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback')
})

function primeActiveVideo() {
  const on  = activeVideo()
  const off = on === $videoMobile ? $videoDesktop : $videoMobile
  off.preload = 'none'
  on.preload = 'auto'
  if (on.readyState < 2) on.load()
}

primeActiveVideo()
if (typeof mqPhone.addEventListener === 'function') {
  mqPhone.addEventListener('change', primeActiveVideo)
} else {
  mqPhone.addListener(primeActiveVideo)
}

window.addEventListener('touchstart', () => {
  const v = activeVideo()
  v.play().then(() => v.pause()).catch(() => {})
}, { once: true, passive: true })

const SECTIONS = [
  { from: 0.00, to: 0.16, label: 'Welcome'            },
  { from: 0.16, to: 0.43, label: 'Pool Automation'    },
  { from: 0.445, to: 0.535, label: 'Fabrication'      },
  { from: 0.55, to: 0.82, label: 'Interior Design'    },
  { from: 0.82, to: 0.94, label: 'Architecture'       },
  { from: 0.94, to: 1.00, label: 'Start Your Project' },
]

const PIN_VH = () => (isMobile() ? 8.5 : 7.5)
const clamp01 = (n) => Math.max(0, Math.min(1, n))

const FILM_FPS = 24
const $scrollTrack = document.querySelector('#scroll-container')
let playhead = 0
let shownFrame = -1
let trackHeight = 0

function dissolveAmount(p) {
  const x = (p - 0.55) / 0.02
  if (Math.abs(x) >= 1) return 0
  return 0.5 * (1 + Math.cos(x * Math.PI))
}

function paintStage(p) {
  const $video = activeVideo()
  const mobile = isMobile()
  const dip = dissolveAmount(p)
  const letterboxed = mobile && p < 0.2

  $dissolve.style.opacity = (dip * 0.16).toFixed(3)
  $video.style.filter = 'none'
  $video.classList.toggle('letterbox', letterboxed)
  if ($ambience) $ambience.style.opacity = letterboxed ? '1' : '0'

  $endSlate.style.opacity = clamp01((p - 0.92) / 0.06).toFixed(3)

  const pct = Math.round(p * 100)
  $bhFill.style.width = pct + '%'
  $bhPct.textContent  = String(pct).padStart(2, '0') + '%'
  $bhHint.style.opacity = p > 0.04 ? '0' : '1'

  let activeSectionIdx = 0
  SECTIONS.forEach((s, i) => {
    if (p >= s.from) {
      $tbLabel.textContent = s.label
      activeSectionIdx = i
    }
  })
  $dots.forEach((d, i) => d.classList.toggle('active', i === activeSectionIdx))

  $cards.forEach((card) => {
    const i = parseInt(card.dataset.section, 10)
    const s = SECTIONS[i]
    if (!s) return
    const f = s.from
    const t = s.to
    const range = t - f
    const FADE = mobile
      ? Math.min(0.06, range * 0.32)
      : Math.min(0.035, range * 0.22)

    if (card.classList.contains('card-cta')) {
      const fade = mobile ? 0.05 : 0.03
      let opacity = 0
      if (p >= f + fade) opacity = 1
      else if (p > f) opacity = (p - f) / fade

      gsap.set(card, {
        opacity,
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: (1 - opacity) * 14,
        force3D: true,
        pointerEvents: opacity > 0.35 ? 'auto' : 'none',
      })
      return
    }

    let opacity

    if (p <= f || p >= t) {
      opacity = 0
    } else {
      const local   = (p - f) / range
      const fadeIn  = FADE / range
      const fadeOut = 1 - FADE / range
      if (local < fadeIn) opacity = local / fadeIn
      else if (local > fadeOut) opacity = (1 - local) / (FADE / range)
      else opacity = 1
      opacity = clamp01(opacity)
    }

    gsap.set(card, {
      opacity,
      xPercent: mobile ? -50 : 0,
      y: 0,
      force3D: true,
      pointerEvents: 'none',
    })
  })
}

function targetFrame(v) {
  const maxFrame = Math.max(0, Math.round(v.duration * FILM_FPS) - 1)
  const raw = playhead * FILM_FPS
  let frame = Math.round(raw)
  if (shownFrame >= 0 && frame !== shownFrame && Math.abs(raw - shownFrame) < 0.58) {
    frame = shownFrame
  }
  return Math.max(0, Math.min(maxFrame, frame))
}

function applyPlayhead() {
  const v = activeVideo()
  if (!v.paused) v.pause()
  if (v.readyState < 2 || !isFinite(v.duration) || v.duration <= 0) return

  const frame = targetFrame(v)
  if (frame === shownFrame) return

  shownFrame = frame
  v.currentTime = Math.min(v.duration - 0.0005, (frame + 0.5) / FILM_FPS)
}

function initExperience() {
  const mobile = isMobile()
  const pinVh = PIN_VH()

  $videoDesktop.pause()
  $videoMobile.pause()

  trackHeight = Math.round(window.innerHeight * pinVh)
  $scrollTrack.style.height = trackHeight + 'px'

  gsap.set($cards, { opacity: 0, y: 0, force3D: true })
  gsap.set('.card-cta', { xPercent: -50, yPercent: -50, y: 14 })

  if (mobile) {
    ScrollTrigger.normalizeScroll(true)
    $bhHint.textContent = '↓  SWIPE TO EXPLORE'
  }

  let lenis = null
  if (!mobile) {
    lenis = new Lenis({
      lerp: 0.08,
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.85,
      syncTouch: false,
      touchMultiplier: 1,
    })
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => { lenis.raf(time * 1000) })
  }

  gsap.ticker.lagSmoothing(0)
  gsap.ticker.add(applyPlayhead)

  $dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.dataset.index, 10)
      const section = SECTIONS[idx]
      if (!section) return
      const y = section.from * trackHeight
      if (lenis) lenis.scrollTo(y, { duration: 1.15 })
      else window.scrollTo({ top: y, behavior: 'smooth' })
    })
  })

  ScrollTrigger.create({
    trigger: '#scroll-container',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate(self) {
      const p = self.progress
      const v = activeVideo()
      if (v.duration && isFinite(v.duration)) {
        playhead = p * v.duration
      }
      paintStage(p)
      applyPlayhead()
    },
  })

  paintStage(0)

  if (!mobile) {
    document.querySelectorAll('.wa-pill').forEach((pill) => {
      pill.addEventListener('mousemove', (e) => {
        const r = pill.getBoundingClientRect()
        gsap.to(pill, {
          x: (e.clientX - r.left - r.width / 2) * 0.22,
          y: (e.clientY - r.top - r.height / 2) * 0.28,
          duration: 0.35,
          ease: 'power2.out',
        })
      })
      pill.addEventListener('mouseleave', () => {
        gsap.to(pill, { x: 0, y: 0, duration: 0.55, ease: 'power3.out' })
      })
    })
  }
}

let loaderDone = false

function dismissLoader() {
  if (loaderDone) return
  loaderDone = true
  $loaderFill.style.width = '100%'
  setTimeout(() => {
    $loader.classList.add('gone')
    initExperience()
  }, 600)
}

let fakeP = 0
const loaderTick = setInterval(() => {
  fakeP = Math.min(fakeP + Math.random() * 15, 88)
  $loaderFill.style.width = fakeP + '%'
}, 130)

const readyEvent = isMobile() ? 'canplaythrough' : 'loadeddata'
activeVideo().addEventListener(readyEvent, () => {
  clearInterval(loaderTick)
  dismissLoader()
}, { once: true })
if (activeVideo().readyState >= (isMobile() ? 3 : 2)) {
  clearInterval(loaderTick)
  dismissLoader()
}

setTimeout(() => { clearInterval(loaderTick); dismissLoader() }, 5000)
