# Credits — Seismology Lab

Locate an earthquake's epicenter from P–S arrival-time differences on real seismograms.

## Data

Every seismogram, station position and epicenter in this simulation is real. `npm run build-data` downloads them; the generated modules under `src/common/data/generated/` are committed.

- **Earthquake catalog.** U.S. Geological Survey, ANSS Comprehensive Earthquake Catalog (ComCat), via the FDSN event service at `earthquake.usgs.gov`. Public domain.
- **Waveforms and station metadata.** Delivered through FDSN `dataselect` and `station` web services by:
  - the EarthScope Consortium data services, formerly the IRIS DMC, for IU, II and AK;
  - the Northern California Earthquake Data Center, NCEDC (doi:10.7932/NCEDC), for BK;
  - the Southern California Earthquake Data Center, SCEDC (doi:10.7909/C3WD3xH1), for CI.
- **Seismic networks.**
  - CI — Caltech / USGS Southern California Seismic Network (doi:10.7914/SN/CI)
  - BK — Berkeley Digital Seismic Network (doi:10.7932/BDSN)
  - AK — Alaska Earthquake Center Regional Seismic Network (doi:10.7914/SN/AK)
  - IU — Global Seismograph Network, IRIS/USGS (doi:10.7914/SN/IU)
  - II — Global Seismograph Network, IRIS/IDA (doi:10.7914/SN/II)
- **Travel times.** The IASP91 Earth model (Kennett, B. L. N. & Engdahl, E. R., 1991, *Geophys. J. Int.* 105, 429–465), computed with TauP 3.2.1 (Crotwell, H. P., Owens, T. J. & Ritsema, J., 1999, *Seismol. Res. Lett.* 70, 154–160).
- **Coastlines.** Natural Earth 1:110m and 1:50m land polygons. Public domain.

## License

GNU Affero General Public License v3.0 or later — see [org LICENSE](https://github.com/OpenLyceum/.github/blob/main/LICENSE).

## Acknowledgments

Built with [SceneryStack](https://scenerystack.org/) as part of the
[OpenLyceum](https://github.com/OpenLyceum) fleet.

## Contributing

See [OpenLyceum contributing guidelines](https://github.com/OpenLyceum/.github/blob/main/CONTRIBUTING.md).
Report bugs via GitHub Issues; use org issue templates.
