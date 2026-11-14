import droughtTolerantImage from "./images/shutterstock_1956949345-2839469729.jpg";

export default function DroughtTolerantArticle() {
    return (
        <div className="tk-article-copy">
            <figure className="tk-article-figure">
                <img
                    src={droughtTolerantImage}
                    alt="Rows of green crops growing in dry, cracked soil."
                />
                <figcaption>
                    Drought-tolerant crops can maintain ground cover during dry periods. https://modernfarmer.com/2022/06/drought-tolerant-crops/
                </figcaption>
            </figure>

            <p>
                Drought-tolerant crops, such as sorghum, millet, and some cowpeas,
                can keep growing through dry spells better than less-adapted crops.
                The right choice depends on the local climate, soil, and variety.
            </p>
            <h3>How this helps soil over time</h3>
            <p>
                Crops that maintain growth during dry periods can keep living roots
                in the ground and provide residue after harvest. That cover can
                reduce erosion and shade the soil surface, while roots and residues
                contribute organic material that supports soil life and structure.
                Including different crops in a rotation can also spread risk and
                diversify root activity.
            </p>
            <p>
                Drought tolerance alone does not add fertility or create water.
                Long-term gains depend on maintaining useful plant cover and
                returning residues while matching crops to local conditions.
            </p>
        </div>
    );
}
