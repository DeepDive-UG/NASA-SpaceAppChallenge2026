import nitrogenFixationImage from "./images/Nitrogen_fixation_by_nitrogen-fixing_plants-1184797408.png";

export default function NitrogenFixingArticle() {
    return (
        <div className="tk-article-copy">
            <figure className="tk-article-figure">
                <img
                    src={nitrogenFixationImage}
                    alt="Diagram of a pulse crop root system showing microbes fixing nitrogen in root nodules. Source: https://www.orchardofflavours.com/nitrogen-fixers"
                />
                <figcaption>
                    Nitrogen fixation: microbes in root nodules fix nitrogen for the crop.
                </figcaption>
            </figure>

            <p>
                Beans, peas, clovers, and other legumes can partner with
                soil-dwelling bacteria called rhizobia. The bacteria live in root
                nodules and convert nitrogen from the air into forms the plant can
                use. This process is called biological nitrogen fixation.
            </p>
            <h3>How this helps soil over time</h3>
            <p>
                When roots and crop residues remain in the field, they return organic
                material that soil organisms can use. Some of the fixed nitrogen is
                then released as that material decomposes, helping support later
                crops and potentially reducing the need for added nitrogen fertilizer.
            </p>
            <p>
                The benefit depends on healthy nodules, suitable growing conditions,
                and how the crop is harvested. Grain or forage removal can take much
                of the nitrogen away, so leaving roots or returning residues matters.
            </p>
        </div>
    );
}
