import Image from "next/image";
import styles from "./page.module.css";
import ReactPlayer from 'react-player'

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <ReactPlayer src='http://localhost:8000/test.mp4' playing muted={true}/>
      </main>
    </div>
  );
}
