import deepRootsImage from "./images/healthy-soil-deep-root-growth-uk-gardens-1024x683-1600655956.jpg";

export default function DeepRootingArticle() {
    return (
        <div className="tk-article-copy">
            <figure className="tk-article-figure">
                <img
                    src={deepRootsImage}
                    alt="Illustration of deep plant roots growing through soil, with arrows showing water movement."
                />
                <figcaption>
                    Deep roots can create channels that help water move through soil. https://gloriousgarden.co.uk/small-roots-heavy-uk-soil/
                </figcaption>
            </figure>

            <p>
                Crops such as alfalfa, sunflower, and some radishes can send roots
                deeper than many common annual crops. Root depth varies with the
                variety and with soil conditions; hard layers, poor drainage, or
                compaction can restrict growth.
            </p>
            <h3>How this helps soil over time</h3>
            <p>
                A varied root system can explore more of the soil profile for water
                and nutrients. Roots that die back leave channels that may improve
                pathways for water, air, and later roots. Deep-rooted crops can also
                bring some nutrients into above-ground growth, where residues may
                return them nearer the surface.
            </p>
            <p>
                These effects build gradually and depend on roots being able to grow.
                Deep-rooted crops can complement good soil management, but they are
                not a guaranteed fix for severe compaction.
            </p>
        </div>
    );
}
