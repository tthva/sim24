import type {Config} from 'tailwindcss'
const config:Config={
  content:['./pages/**/*.{js,ts,jsx,tsx,mdx}','./components/**/*.{js,ts,jsx,tsx,mdx}','./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme:{
    extend:{
      colors:{acc:'#51BB70','acc-light':'#88FFA4','acc-bright':'#23E250',prim:'#011B2C','navy-dark':'#11223D','navy-light':'#1C3968'},
      fontFamily:{vazir:['Vazirmatn','sans-serif']},
    },
  },
  plugins:[],
}
export default config
