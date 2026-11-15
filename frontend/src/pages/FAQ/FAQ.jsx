import { Link } from 'react-router-dom'
import Navigation from '../../components/Navigation/Navigation'
import MascotChat from '../../components/MascotChat'
import './FAQ.css'

const sections = [
  { title: 'Your field', questions: [
    ['Where do I start?', <>Open <Link to="/myField">My field</Link>. Add your location, field size, soil, past crops and water source. Then open <Link to="/crop-rotation">Crop rotation</Link>.</>],
    ['What if I do not know something?', 'Choose “Not known” where available. Add only what you do know, but missing details may affect the accuracy of the recommendations.'],
    ['What are sectors?', 'Parts of your field that you manage separately. Add sectors if their soil, crops or watering differ. The coloured picture shows their sizes, not exact boundaries.'],
    ['Where can I change my details?', 'Use My field. In Crop rotation, use Edit field, Edit goals or Edit history. You can make changes without leaving the page.'],
    ['Why add my past crops and fertilisers?', 'Past crops and fertiliser affect soil health and the fit of future crops. Add what you know, even if it is only a few years.'],
  ] },
  { title: 'Choosing a crop', questions: [
    ['How do I set my goals?', 'Move the four goal sliders. Others sliders adjust so the total stays at 100%.'],
    ['Does Earn more tell me my profit?', 'No. It gives example market prices a small part in choosing between crops with the same fit colour. What you earn also depends on your harvest, costs and sale price.'],
    ['Does my equipment matter?', <>Yes. Add it in <Link to="/myGear">My gear</Link>. We check whether harvesting may need different equipment or a contractor. </>],
  ] },
  { title: 'Weather, water & alerts', questions: [
    ['Where do the growing estimates come from?', 'NASA satellite data combined with weather and soil models. They describe the wider area, not measurements taken on your farm.'],
    ['Are these estimates for today?', 'Read the dates above the numbers. If newer data is missing, we show the last available period. That is not a new forecast starting today.'],
    ['Does a nearby river tell me how much water my well has?', 'No. River readings describe that station. They do not measure your well or confirm how much water you can use.'],
    ['What do the three alert groups mean?', 'Water warnings: possible flooding. Fire weather: weather that helps fires spread. Reported fires: places where a fire was reported. Check the place name; the lists cover California.'],
    ['What should I do when I see an alert?', 'Open the report to read the official advice. Follow local emergency services. Reports can arrive late, so do not wait for this app in an emergency.'],
  ] },
  { title: 'Ask Tip', questions: [
    ['What can I ask Tip?', 'Ask about crops, soil, planting, water or crop rotation. Tip answers from the app’s saved reference material.'],
    ['Does Tip remember my last question?', 'No. Each question starts fresh. Name the crop and place again when they matter.'],
    ['Does Tip know the latest weather or alerts?', 'No. Check the growing estimates and the Water & fire alerts window separately. Tip does not use live weather or station readings to generate a response.'],
    ['How do I make the text bigger?', <>Open <Link to="/settings">Settings</Link>. Choose a larger font size. You can also change the theme and contrast.</>],
  ] },
]

export default function FAQ() {
  return <div className="faq-layout"><Navigation /><main className="faq-main"><header><h1>FAQ</h1><p>A little help with CropTips.</p></header>{sections.map(section => <section key={section.title} className="faq-section"><h2>{section.title}</h2>{section.questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>)}</main><MascotChat /></div>
}
