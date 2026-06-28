import Skeleton from "react-loading-skeleton";

import "react-loading-skeleton/dist/skeleton.css";

export default function LoadingCard(){

    return(

        <div className="rounded-xl bg-zinc-900 p-6">

            <Skeleton height={35}/>

            <Skeleton count={5}/>

        </div>

    );

}