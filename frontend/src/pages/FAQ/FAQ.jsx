import { Link } from 'react-router-dom'
import Navigation from '../../components/Navigation/Navigation'
import MascotChat from '../../components/MascotChat'
import './FAQ.css'

const sections = [
  { title: 'Your field', questions: [
    ['Where do I start?', <>Open <Link to="/myField">My field</Link>. Add your location, field size, soil, past crops and water source. Then open <Link to="/crop-rotation">Crop rotation</Link>.</>],
    ['What if I do not know something?', 'Choose “Not known” where available. Add what you do know. Missing details mean fewer checks, so a soil test can help.'],
    ['What are sectors?', 'Parts of your field that you manage separately. Add sectors if their soil, crops or watering differ. The coloured picture shows their sizes, not exact boundaries.'],
    ['Where can I change my details?', 'Use My field. In Crop rotation, use Edit field, Edit goals or Edit history. You can make changes without leaving the page.'],
    ['Why add my past crops and fertilisers?', 'Past crops help us check whether you are repeating the same crop family. Fertiliser records show what you applied, not what nutrients remain in the soil.'],
  ] },
  { title: 'Choosing a crop', questions: [
    ['What do green, yellow and red mean?', 'Green: the recorded soil and past crops fit. Yellow: some checks are missing or need attention. Red: a mismatch was found. Green does not guarantee a safe planting or harvest.'],
    ['How do I set my goals?', 'Move the four goal sliders: a good harvest, healthy soil, less water and earn more. The others adjust so the total stays at 100%.'],
    ['Does Earn more tell me my profit?', 'No. It gives example market prices a small part in choosing between crops with the same fit colour. What you earn also depends on your harvest, costs and sale price.'],
    ['Are the crop prices live?', 'No. The current prices are examples. Each price shows its date and unit. Your price at harvest may be different. Some crops have no listed price.'],
    ['Does my equipment matter?', <>Yes. Add it in <Link to="/myGear">My gear</Link>. We check whether harvesting may need different equipment or a contractor. Equipment does not guarantee a bigger harvest.</>],
  ] },
  { title: 'Weather, water & alerts', questions: [
    ['Where do the growing estimates come from?', 'NASA satellite data combined with weather and soil models. They describe the wider area, not measurements taken on your farm.'],
    ['Are these estimates for today?', 'Read the dates above the numbers. If newer data is missing, we show the last available period. That is not a new forecast starting today.'],
    ['Is the temperature for air or soil?', 'Air and soil temperatures are listed separately. Soil temperature describes the top layer of NASA’s soil model, not a thermometer on your farm. Open the “i” beside each value for details.'],
    ['Can the estimates tell me there will be no frost?', 'No. Conditions on your field can differ from the wider area. Check a current local forecast before planting a crop that frost could damage.'],
    ['Does a nearby river tell me how much water my well has?', 'No. River readings describe that station. They do not measure your well or confirm how much water you can use.'],
    ['What do the three alert groups mean?', 'Water warnings: possible flooding. Fire weather: weather that helps fires spread. Reported fires: places where a fire was reported. Check the place name; the lists cover California.'],
    ['What should I do when I see an alert?', 'Open the report to read the official advice. Follow local emergency services. Reports can arrive late, so do not wait for this app in an emergency.'],
  ] },
  { title: 'Ask Tip', questions: [
    ['What can I ask Tip?', 'Ask about crops, soil, planting, water or crop rotation. Tip answers from the app’s saved reference material. Open Sources to see what the answer is based on.'],
    ['Does Tip remember my last question?', 'No. Each question starts fresh. Name the crop and place again when they matter.'],
    ['Does Tip know the latest weather or alerts?', 'No. Check the growing estimates and the Water & fire alerts window separately. Tip does not fetch live weather or station readings.'],
    ['How do I make the text bigger?', <>Open <Link to="/settings">Settings</Link>. Choose a larger font size. You can also change the theme and contrast.</>],
  ] },
]

export default function FAQ() {
  return <div className="faq-layout"><Navigation /><main className="faq-main"><header><h1>FAQ</h1><p>A little help with CropTips.</p></header>{sections.map(section => <section key={section.title} className="faq-section"><h2>{section.title}</h2>{section.questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>)}</main><MascotChat /></div>
}
