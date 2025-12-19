import streamlit as st

from src.dem import get_elevation_from_dem
from src.gis import SUPPORTED_CRS, build_point, reproject_point, spatial_join_point
from src.word_fill import render_report


st.set_page_config(page_title="Informe por coordenada", page_icon="🗺️")

st.title("Generador de informes por coordenada")
st.write("Ingrese una coordenada, seleccione el CRS y genere un informe Word.")

with st.form("coordinate_form"):
    col_x, col_y = st.columns(2)
    with col_x:
        x_coord = st.number_input("Coordenada X", format="%.6f")
    with col_y:
        y_coord = st.number_input("Coordenada Y", format="%.6f")

    crs_code = st.selectbox("CRS", list(SUPPORTED_CRS.keys()), index=0)

    st.markdown("**Archivos de referencia**")
    shapefile_name = st.text_input(
        "Nombre del shapefile (en /data)", value="capas.shp"
    )
    dem_name = st.text_input("Nombre del DEM (en /data)", value="dem.tif")
    template_name = st.text_input(
        "Plantilla Word (en /templates)", value="plantilla.docx"
    )

    submitted = st.form_submit_button("Generar informe")

if submitted:
    try:
        point = build_point(x_coord, y_coord, crs_code)
        point_wgs84 = reproject_point(point, SUPPORTED_CRS["EPSG:4326"])
        st.success("Coordenada procesada correctamente.")

        st.subheader("Resultados GIS")
        st.write(
            {
                "x": point.geometry.x,
                "y": point.geometry.y,
                "crs": point.crs.to_string(),
            }
        )
        st.write(
            {
                "lon": point_wgs84.geometry.x,
                "lat": point_wgs84.geometry.y,
            }
        )

        join_result = spatial_join_point(point, shapefile_name)
        st.dataframe(join_result.drop(columns="geometry"), use_container_width=True)

        elevation = get_elevation_from_dem(point.geometry.x, point.geometry.y, dem_name)
        st.write({"altitud": elevation})

        context = {
            "coordenada_x": point.geometry.x,
            "coordenada_y": point.geometry.y,
            "crs": point.crs.to_string(),
            "lon": point_wgs84.geometry.x,
            "lat": point_wgs84.geometry.y,
            "altitud": elevation,
        }

        report_bytes = render_report(context, template_name)

        st.download_button(
            label="Descargar informe Word",
            data=report_bytes,
            file_name="informe.docx",
            mime=(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
        )
    except Exception as exc:
        st.error(f"Error al generar el informe: {exc}")
