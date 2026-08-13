/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // §14 디자인 방향: 올리브 그린 + 크림 베이지 (하드웨어 색상 일치)
        olive: {
          50: '#f6f7ef',
          100: '#e9ecd6',
          200: '#d4daaf',
          300: '#b9c382',
          400: '#a0ad5e',
          500: '#849244',
          600: '#667434',
          700: '#4e592c',
          800: '#404827',
          900: '#373e25',
        },
        cream: {
          50: '#fdfbf5',
          100: '#faf5e8',
          200: '#f3e9cf',
          300: '#e9d9ae',
          400: '#ddc386',
          500: '#d0ab63',
        },
        state: {
          dry: '#d9603b',
          good: '#5b9c4a',
          wet: '#3b82c4',
          warn: '#d99a20',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bob: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'sparkle-up': {
          '0%': { transform: 'translateY(0) scale(0.6)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'translateY(-70px) scale(1.1)', opacity: '0' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        // 기분별 캐릭터 움직임
        droop: {
          '0%,100%': { transform: 'rotate(-3deg) translateY(2px)' },
          '50%': { transform: 'rotate(-5deg) translateY(5px)' },
        },
        shiver: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-2px)' },
          '40%': { transform: 'translateX(2px)' },
          '60%': { transform: 'translateX(-1.5px)' },
          '80%': { transform: 'translateX(1.5px)' },
        },
        sleep: {
          '0%,100%': { transform: 'scale(1) translateY(0)' },
          '50%': { transform: 'scale(0.98) translateY(3px)' },
        },
        sway: {
          '0%,100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        glitch: {
          '0%,92%,100%': { transform: 'translate(0)', opacity: '1' },
          '94%': { transform: 'translate(-2px, 1px)', opacity: '0.75' },
          '96%': { transform: 'translate(2px, -1px)', opacity: '1' },
        },
        'float-away': {
          '0%': { transform: 'translateY(0) scale(0.7)', opacity: '0' },
          '25%': { opacity: '0.95' },
          '100%': { transform: 'translateY(-56px) scale(1.05)', opacity: '0' },
        },
      },
      animation: {
        'pop-in': 'pop-in 380ms ease-out',
        bob: 'bob 2.4s ease-in-out infinite',
        'sparkle-up': 'sparkle-up 1.2s ease-out forwards',
        shake: 'shake 400ms ease-in-out',
        droop: 'droop 3.2s ease-in-out infinite',
        shiver: 'shiver 1.4s ease-in-out infinite',
        sleep: 'sleep 3.6s ease-in-out infinite',
        sway: 'sway 3s ease-in-out infinite',
        glitch: 'glitch 3s steps(1) infinite',
        'float-away': 'float-away 2.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
