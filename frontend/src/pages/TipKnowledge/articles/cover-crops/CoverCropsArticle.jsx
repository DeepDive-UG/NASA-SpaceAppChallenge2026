import coverCropsImage from "./images/cover-crops-corn-stubble-radishes-Vance0227F3-3545_0.jpg";

export default function CoverCropsArticle() {
    return (
        <div className="tk-article-copy">
            <figure className="tk-article-figure">
                <img
                    src={coverCropsImage}
                    alt="Green cover crops growing between rows of harvested corn stubble."
                />
                <figcaption>
                    A cover crop protects the soil between cash-crop seasons. https://www.farmprogress.com/cover-crops/10-reasons-to-use-cover-crops
                </figcaption>
            </figure>

            <p>
                Cover crops are planted to protect and improve the ground between
                harvests or alongside a main crop. Grasses, legumes, and other
                species can be selected alone or in mixtures to suit local conditions.
            </p>
            <h3>How this helps soil over time</h3>
            <p>
                Living leaves soften the impact of rain and help shield bare soil from
                wind. Their roots hold soil in place, take up some leftover nutrients
                that might otherwise leach away, and feed soil organisms. After the
                cover crop is terminated, its residues can add organic matter and
                help maintain soil structure.
            </p>
            <p>
                Legume cover crops can also fix nitrogen. Choose planting and
                termination dates carefully: a cover crop that uses too much water
                or competes with the next crop can reduce its benefits.
            </p>
        </div>
    );
}
